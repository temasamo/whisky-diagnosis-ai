import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";

const FEEDS = [
  { key: "asahi_hd",         url: process.env.ASAHI_RSS_GROUP },
  { key: "prtimes_kw_nikka", url: process.env.PRTIMES_RSS_NIKKA_KW },
  { key: "prtimes_kw_asahi", url: process.env.PRTIMES_RSS_ASAHI_KW },
  { key: "prtimes_all",      url: process.env.PRTIMES_RSS_MAIN }, // 最後の保険
].filter((x): x is { key: string; url: string } => !!x.url);

const NIKKA_RE = new RegExp(
  "(ニッカウヰスキー|ニッカウイスキー|ニッカ|Nikka|竹鶴|Taketsuru|余市|Yoichi|宮城峡|Miyagikyo|ブラックニッカ|From the Barrel|フロム・ザ・バレル|アップルブランデー|シングルモルト余市|シングルモルト宮城峡)",
  "i"
);

function normalizeLinkFromItem(it: any): string {
  // RSS: <link> / RDF: 属性（@_rdf:about or @_about）
  const raw = String(
    it?.link || it?.["@_rdf:about"] || it?.["@_about"] || it?.guid || ""
  ).trim();
  if (!raw) return raw;
  const m = raw.match(/^https?:\/\/[^h]+(https?:\/\/.+)$/); // Asahi二重ドメイン対策
  return m ? m[1] : raw;
}

function pickImage(item: any): string | null {
  const enc = item?.enclosure?.["@_url"] || item?.enclosure?.url;
  const media = item?.["media:content"]?.["@_url"] || item?.["media:content"]?.url;
  return enc || media || null;
}

function mkHash(title: string, link: string, pubDate?: string) {
  const base = `${(title||"").trim()}|${(link||"").trim()}|${(pubDate||"").slice(0,10)}`;
  return crypto.createHash("sha1").update(base).digest("hex");
}

async function fetchFeed(url: string) {
  const xml = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      referer: "https://www.asahigroup-holdings.com/",
    },
    redirect: "follow",
    cache: "no-store",
  }).then(r => r.text());
  
  // RDF対応を確実にする
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const js = parser.parse(xml);

  const rssItems = js?.rss?.channel?.item;
  const rdfItems = js?.rdf?.item || js?.["rdf:RDF"]?.item;
  const items = Array.isArray(rssItems)
    ? rssItems
    : rssItems ? [rssItems]
    : Array.isArray(rdfItems)
    ? rdfItems
    : rdfItems ? [rdfItems]
    : [];

  return items;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 環境変数チェック
    if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return res.status(500).json({ error: "SUPABASE_URL missing" });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // upsertなのでService Roleを使用
    );

    // フィードURLチェック
    if (FEEDS.length === 0) {
      return res.status(500).json({ 
        error: "No RSS feeds configured. Please set environment variables: ASAHI_RSS_GROUP, ASAHI_RSS_BEER, PRTIMES_RSS_ASAHI" 
      });
    }

    const rows: any[] = [];
    for (const f of FEEDS) {
      const items = await fetchFeed(f.url);
      for (const it of items) {
        const title = String(it.title || "").trim();
        const link  = normalizeLinkFromItem(it);
        const desc  = String(it.description || "").trim();
        const html  = String(it["content:encoded"] || "");
        const pub   = String(it.pubDate || it["dc:date"] || "");

        const text = `${title}\n${desc}\n${html}`;
        if (!NIKKA_RE.test(text)) continue;

        rows.push({
          source: f.key,
          brand_hint: "nikka",
          title,
          link,
          pub_date: pub ? new Date(pub).toISOString() : null,
          description: desc,
          image_url: pickImage(it),
          raw: it,
          unique_hash: mkHash(title, link, pub),
        });
      }
    }

    // 重複排除
    const uniq = new Map<string, any>();
    for (const r of rows) uniq.set(r.unique_hash, r);
    const payload = Array.from(uniq.values());

    // ✅ ドライラン機能追加：?dry=1 ならDBに書かず診断を返す
    if (req.query.dry === "1") {
      // タイトルだけ数件返す
      return res.status(200).json({
        feeds: FEEDS.map(f => f.url),
        matched: payload.length,
        sample: payload.slice(0, 5).map(x => ({ 
          source: x.source, 
          title: x.title, 
          link: x.link, 
          pub_date: x.pub_date 
        }))
      });
    }

    if (!payload.length) {
      return res.status(200).json({ inserted: 0, note: "no Nikka items matched" });
    }

    // ここから保存
    console.log("Attempting to insert payload:", JSON.stringify(payload, null, 2));
    
    // まず既存データをチェック
    const existingHashes = payload.map(p => p.unique_hash);
    const { data: existing, error: checkError } = await supabase
      .from("whisky_news")
      .select("unique_hash")
      .in("unique_hash", existingHashes);
    
    if (checkError) {
      console.error("Check existing error:", checkError);
      return res.status(500).json({ 
        error: checkError.message, 
        details: checkError.details,
        hint: checkError.hint,
        code: checkError.code
      });
    }
    
    const existingHashesSet = new Set((existing || []).map(e => e.unique_hash));
    const newItems = payload.filter(p => !existingHashesSet.has(p.unique_hash));
    
    console.log(`Found ${existing?.length || 0} existing items, ${newItems.length} new items to insert`);
    
    if (newItems.length === 0) {
      return res.status(200).json({ 
        inserted: 0, 
        tried: payload.length, 
        note: "all items already exist" 
      });
    }
    
    const { data, error } = await supabase
      .from("whisky_news")
      .insert(newItems);

    console.log("Supabase response:", { data, error });

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ 
        error: error.message, 
        details: error.details,
        hint: error.hint,
        code: error.code,
        tried: newItems.length 
      });
    }

    res.status(200).json({ 
      inserted: data?.length ?? 0, 
      tried: payload.length,
      newItems: newItems.length,
      existing: existing?.length || 0
    });
  } catch (e: any) {
    console.error("Nikka ETL error:", e);
    res.status(500).json({ error: e?.message || "nikka etl failed" });
  }
}
