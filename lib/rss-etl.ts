// lib/rss-etl.ts
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

type FeedItem = {
  title: string;
  link: string;
  pubDate?: string;     // RSS2.0
  dcDate?: string;      // RDF/Atom
  description?: string;
  sourceOrg: "Suntory" | "PRTIMES";
  priority: number;     // 0: 公式を優先, 1: 補完
};

const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPA_URL) throw new Error("SUPABASE_URL missing");
if (!SUPA_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
const supa = createClient(SUPA_URL, SUPA_KEY);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  trimValues: true,
  parseTagValue: true,
});

/** タイトル→ブランド/表現の簡易抽出（必要に応じて辞書を増強） */
function extractBrandExpression(title: string) {
  const brandHints = [
    // Suntory JP
    "山崎","白州","響","知多","碧","マッカラン","ボウモア","ラフロイグ","オーヘントッシャン","アードモア",
    // EN
    "Yamazaki","Hakushu","Hibiki","Chita","Ao","Macallan","Bowmore","Laphroaig","Auchentoshan","Ardmore",
    "Glenfiddich","Lagavulin","Glenlivet","Glenmorangie"
  ];
  const hit = brandHints.find(b => title.toLowerCase().includes(b.toLowerCase()));
  const brand = hit ?? "Suntory";
  // ざっくり：ブランド名を除いた残りを expression 候補に
  const expr = title.replace(new RegExp(hit ?? "", "i"), "").trim().replace(/^\s*[-–—:：]\s*/, "");
  const expression = expr || (hit ? `${hit}` : title);
  return { brand, expression };
}

/** 金額・通貨の抽出（最低限） */
function extractPriceCurrency(text: string | undefined) {
  if (!text) return { price_minor: null as number | null, currency: null as string | null };
  const yen = text.match(/([￥¥]?\s?[\d,]+)\s?円/);
  if (yen) {
    const num = parseInt(yen[1].replace(/[￥¥,\s]/g, ""), 10);
    return { price_minor: num * 100, currency: "JPY" };
  }
  const gbp = text.match(/£\s?([\d,.]+)/);
  if (gbp) return { price_minor: Math.round(parseFloat(gbp[1]) * 100), currency: "GBP" };
  const usd = text.match(/\$\s?([\d,.]+)/);
  if (usd) return { price_minor: Math.round(parseFloat(usd[1]) * 100), currency: "USD" };
  return { price_minor: null, currency: null };
}

/** RSS2.0（公式）→ FeedItem[] */
export function parseSuntoryRSS(xml: string): FeedItem[] {
  const j = parser.parse(xml);
  const items = j?.rss?.channel?.item ?? [];
  return items.map((it: any) => ({
    title: it.title,
    link: it.link,
    pubDate: it.pubDate,
    description: it.description,
    sourceOrg: "Suntory",
    priority: 0,
  }));
}

/** RDF（PRTIMES）→ FeedItem[] */
export function parsePRTimesRDF(xml: string): FeedItem[] {
  const j = parser.parse(xml);
  // 構造は channel -> items -> Seq -> li(resource=記事URL) の列挙 + 各 <item> の詳細
  const seq = j?.rdf?.channel?.items?.Seq?.li ?? [];
  const urls: string[] = Array.isArray(seq) ? seq.map((x: any) => x.resource) : [seq.resource];

  const itemMap: Record<string, any> = {};
  const items = j?.rdf?.item ?? [];
  (Array.isArray(items) ? items : [items]).forEach((node: any) => {
    if (node?.link) itemMap[node.link] = node;
  });

  return urls.map((url) => {
    const node = itemMap[url] ?? {};
    return {
      title: node.title ?? url,
      link: url,
      dcDate: node["dc:date"],
      description: node.description,
      sourceOrg: "PRTIMES" as const,
      priority: 1,
    };
  });
}

/** ISO日付（JST→日付型） */
function toISODate(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

type UpsertResult = { inserted: number; updated: number; skipped: number };

/** FeedItem[] → Supabase upsert（公式優先、重複吸収） */
export async function upsertFeed(items: FeedItem[], marketDefault = "Global"): Promise<UpsertResult> {
  let inserted = 0, updated = 0, skipped = 0;

  for (const it of items) {
    // 重複：source_org + source_url で即スキップ
    const { data: dup } = await supa
      .from("releases")
      .select("id, source_priority")
      .eq("source_org", it.sourceOrg)
      .eq("source_url", it.link)
      .maybeSingle();

    if (dup) { skipped++; continue; }

    // タイトルから brand / expression
    const { brand, expression } = extractBrandExpression(it.title);
    // 価格
    const { price_minor, currency } = extractPriceCurrency(it.description);

    // brands
    const { data: b, error: bErr } = await supa
      .from("brands")
      .upsert({ name: brand }, { onConflict: "name" })
      .select("id").single();
    if (bErr) throw bErr;

    // expressions
    const { data: e, error: eErr } = await supa
      .from("expressions")
      .upsert({ brand_id: b!.id, name: expression }, { onConflict: "brand_id,name" })
      .select("id").single();
    if (eErr) throw eErr;

    // 発表日（press）として保存
    const announced = toISODate(it.pubDate ?? it.dcDate) ?? toISODate(new Date().toISOString());

    // 既存（同一表現×市場×発表日、press）をチェック
    const { data: exists } = await supa
      .from("releases")
      .select("id, source_priority")
      .eq("expression_id", e!.id)
      .eq("market", marketDefault)
      .eq("source_type", "press")
      .eq("announced_date", announced)
      .maybeSingle();

    if (exists) {
      // 公式(0) が PR補完(1)に勝つ、同値はスキップ
      if ((exists.source_priority ?? 1) <= it.priority) { skipped++; continue; }
      const { error: uErr } = await supa.from("releases").update({
        source_org: it.sourceOrg,
        source_url: it.link,
        source_priority: it.priority,
        price_minor, currency,
      }).eq("id", exists.id);
      if (uErr) throw uErr;
      updated++; continue;
    }

    // 新規 insert（press）
    const { error: rErr } = await supa.from("releases").upsert({
      expression_id: e!.id,
      announced_date: announced,
      on_sale_date: null,
      market: marketDefault,
      source_type: "press",
      retailer: null,
      source_org: it.sourceOrg,
      source_url: it.link,
      source_priority: it.priority,
      price_minor, currency,
      stock_status: null,
    }, { onConflict: "expression_id,market,on_sale_date,retailer" });
    if (rErr) throw rErr;
    inserted++;
  }

  return { inserted, updated, skipped };
}

/** フィードをまとめて取り込む */
export async function runCombinedSuntoryFeeds() {
  const officialUrl = process.env.SUNTORY_NEWS_RSS_URL!;
  const prtimesUrl = process.env.PRTIMES_SUNTORY_RSS_URL!;
  if (!officialUrl) throw new Error("SUNTORY_NEWS_RSS_URL missing");
  if (!prtimesUrl) throw new Error("PRTIMES_SUNTORY_RSS_URL missing");

  const [oRes, pRes] = await Promise.all([fetch(officialUrl), fetch(prtimesUrl)]);
  const [oXml, pXml] = await Promise.all([oRes.text(), pRes.text()]);

  const official = parseSuntoryRSS(oXml);
  const prtimes = parsePRTimesRDF(pXml);

  // 公式優先で結合（同じURLは公式を残す）
  const seen = new Set<string>();
  const merged: FeedItem[] = [];
  for (const x of [...official, ...prtimes]) {
    if (seen.has(x.link)) continue;
    seen.add(x.link);
    merged.push(x);
  }

  return upsertFeed(merged, "Global");
}
