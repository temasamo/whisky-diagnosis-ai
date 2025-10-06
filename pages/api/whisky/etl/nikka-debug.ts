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
  console.log(`Fetching feed: ${url}`);
  const xml = await fetch(url, { 
    headers: { 
      accept: "application/xml,text/xml",
      "User-Agent": "Mozilla/5.0 (compatible; WhiskyNewsBot/1.0)"
    } 
  }).then(r => r.text());
  console.log(`Feed response length: ${xml.length}`);
  
  // RDF対応を確実にする
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const js = parser.parse(xml);

  const rssItems = js?.rss?.channel?.item;
  const rdfItems = js?.rdf?.item; // ← RDF対応
  const items = Array.isArray(rssItems)
    ? rssItems
    : rssItems ? [rssItems]
    : Array.isArray(rdfItems)
    ? rdfItems
    : rdfItems ? [rdfItems]
    : [];

  console.log(`Parsed items count: ${items.length}`);
  return items;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const debugInfo: any = {
    feeds: FEEDS,
    feedCount: FEEDS.length,
    results: []
  };

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
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // フィードURLチェック
    if (FEEDS.length === 0) {
      return res.status(500).json({ 
        error: "No RSS feeds configured. Please set environment variables: ASAHI_RSS_GROUP, ASAHI_RSS_BEER, PRTIMES_RSS_ASAHI" 
      });
    }

    const rows: any[] = [];
    
    for (const f of FEEDS) {
      console.log(`Processing feed: ${f.key} (${f.url})`);
      
      try {
        const items = await fetchFeed(f.url);
        console.log(`Feed ${f.key}: ${items.length} items found`);
        
        let matchedItems = 0;
        let nikkaItems = 0;
        
        for (const it of items) {
          const title = String(it.title || "").trim();
          const link  = normalizeLinkFromItem(it);
          const desc  = String(it.description || "").trim();
          const html  = String(it["content:encoded"] || "");
          const pub   = String(it.pubDate || it["dc:date"] || "");

          const text = `${title}\n${desc}\n${html}`;
          
          // 全アイテムをカウント
          matchedItems++;
          
          // ニッカ関連チェック
          const isNikka = NIKKA_RE.test(text);
          if (isNikka) {
            nikkaItems++;
            console.log(`Nikka match found: ${title}`);
            
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
        
        debugInfo.results.push({
          feed: f.key,
          url: f.url,
          totalItems: items.length,
          matchedItems,
          nikkaItems,
          sampleTitles: items.slice(0, 3).map((it: any) => it.title || "No title")
        });
        
      } catch (feedError: any) {
        console.error(`Error processing feed ${f.key}:`, feedError);
        debugInfo.results.push({
          feed: f.key,
          url: f.url,
          error: feedError.message
        });
      }
    }

    // 重複排除
    const uniq = new Map<string, any>();
    for (const r of rows) uniq.set(r.unique_hash, r);
    const payload = Array.from(uniq.values());

    debugInfo.totalRows = rows.length;
    debugInfo.uniqueRows = payload.length;
    debugInfo.nikkaRegex = NIKKA_RE.toString();

    if (!payload.length) {
      return res.status(200).json({ 
        inserted: 0, 
        note: "no Nikka items matched",
        debug: debugInfo
      });
    }

    const { data, error } = await supabase
      .from("whisky_news")
      .upsert(payload, { onConflict: "unique_hash" });

    if (error) throw error;

    res.status(200).json({ 
      inserted: data?.length ?? 0,
      debug: debugInfo
    });
  } catch (e: any) {
    console.error("Nikka ETL error:", e);
    res.status(500).json({ 
      error: e?.message || "nikka etl failed",
      debug: debugInfo
    });
  }
}
