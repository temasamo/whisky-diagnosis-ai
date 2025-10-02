import type { NextApiRequest, NextApiResponse } from "next";
import type { RawProduct, GroupedResult, SearchResponse } from "@/types/search";
import { canonicalKey, parseVolume, parseAbv } from "@/lib/normalize";
import { winsorize } from "@/lib/price";
import { badStore } from "@/lib/stores";

// 環境変数を直接読み込み
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID || "1034629000425828286";
const YAHOO_APP_ID = process.env.YAHOO_APP_ID || "dj00aiZpPUdDbHlSZEk2WG90dCZzPWNvbnN1bWVyc2VjcmV0Jng9NWM-";
const NO_FILTER = process.env.NO_FILTER === "1";

const clean = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();

// 検索語を最適化（具体的すぎる検索語を簡素化）
function optimizeQuery(q: string): string {
  let optimized = q.toLowerCase();
  
  // 日本語の地域名を英語に変換
  optimized = optimized.replace(/スペイサイド/g, 'speyside');
  optimized = optimized.replace(/アイラ/g, 'islay');
  optimized = optimized.replace(/ハイランド/g, 'highland');
  optimized = optimized.replace(/ジャパニーズ/g, 'japanese');
  
  // 冗長な語句を削除・簡素化
  optimized = optimized.replace(/ピート控えめ/g, '');
  optimized = optimized.replace(/ピート/g, '');
  optimized = optimized.replace(/シングルモルト/g, 'single malt');
  optimized = optimized.replace(/ウイスキー/g, 'whisky');
  
  // 容量情報を削除（検索を広げるため）
  optimized = optimized.replace(/\d+ml/g, '');
  
  // 余分な空白を整理
  optimized = optimized.replace(/\s+/g, ' ').trim();
  
  // 空になった場合は基本的な検索語にフォールバック
  if (!optimized || optimized.length < 3) {
    optimized = 'whisky';
  }
  
  return optimized;
}

async function searchRakuten(q: string): Promise<RawProduct[]> {
  const optimizedQ = optimizeQuery(q);
  console.log(`Rakuten search: ${optimizedQ}`);
  
  // 楽天APIのパラメータを修正（hits=30以下に制限）
  const params = new URLSearchParams();
  params.set("format", "json");
  params.set("applicationId", RAKUTEN_APP_ID);
  params.set("keyword", optimizedQ);
  params.set("hits", "30");
  params.set("imageFlag", "1");
  params.set("sort", "+itemPrice");
  
  const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params.toString()}`;
  console.log(`Rakuten URL: ${url}`);
  
  const r = await fetch(url); 
  if (!r.ok) {
    console.error(`Rakuten API error: ${r.status} ${r.statusText}`);
    const errorText = await r.text();
    console.error(`Rakuten error response: ${errorText}`);
    throw new Error(`rakuten ${r.status}`);
  }
  
  const data = await r.json();
  console.log(`Rakuten response: ${JSON.stringify(data).substring(0, 200)}...`);
  
  const items = data.Items?.map((w: Record<string, unknown>)=>w.Item) || [];
  console.log(`Rakuten items found: ${items.length}`);
  
  return items.map((it: Record<string, unknown>)=>({
    mall:"rakuten" as const, id:String(it.itemCode || it.itemUrl), title: clean(it.itemName as string),
    price: Number(it.itemPrice ?? null), url: it.itemUrl as string,
    image: (it.mediumImageUrls as { imageUrl: string }[])?.[0]?.imageUrl || (it.smallImageUrls as { imageUrl: string }[])?.[0]?.imageUrl || null,
    shop: it.shopName as string || null,
    volume_ml: parseVolume(it.itemName as string), abv: parseAbv(it.itemName as string)
  }));
}

async function searchYahoo(q: string): Promise<RawProduct[]> {
  const optimizedQ = optimizeQuery(q);
  console.log(`Yahoo search: ${optimizedQ}`);
  
  const u = new URL("https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch");
  u.searchParams.set("appid", YAHOO_APP_ID); 
  u.searchParams.set("query", optimizedQ);
  u.searchParams.set("results","50");
  u.searchParams.set("sort","+price");
  
  console.log(`Yahoo URL: ${u.toString()}`);
  
  const r = await fetch(u.toString()); 
  if (!r.ok) {
    console.error(`Yahoo API error: ${r.status} ${r.statusText}`);
    throw new Error(`yahoo ${r.status}`);
  }
  
  const data = await r.json();
  console.log(`Yahoo response: ${JSON.stringify(data).substring(0, 200)}...`);
  
  const items = data.hits || [];
  console.log(`Yahoo items found: ${items.length}`);
  
  return items.map((it: Record<string, unknown>)=>({
    mall:"yahoo" as const, id:String(it.code || it.url), title: clean(it.name as string),
    price: Number(it.price ?? (it.priceLabel as { defaultPrice: number })?.defaultPrice ?? null), url: it.url as string,
    image: (it.image as { medium?: string; small?: string })?.medium || (it.image as { medium?: string; small?: string })?.small || null, 
    shop: (it.seller as { name: string })?.name || null,
    volume_ml: parseVolume(it.name as string), abv: parseAbv(it.name as string)
  }));
}

function whiskyFilter(p: RawProduct): boolean {
  if (NO_FILTER) return true;
  const t = p.title.toLowerCase();
  if (/(日本酒|清酒|焼酎|ビール|ワイン|梅酒|スパークリング|ブランデー)/.test(t)) return false;
  if (!/(ウイスキー|whisky|whiskey)/.test(t)) return false;
  if (badStore(p.shop || "")) return false;
  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse | { error: string }>
) {
  try {
    const q = clean(String(req.query.q || ""));
    const budget = Number(req.query.budget || 0);
    if (!q) return res.status(400).json({ error: "q is required" });

    console.log(`Original query: ${q}`);
    console.log(`Optimized query: ${optimizeQuery(q)}`);

    const [rk, yh] = await Promise.all([searchRakuten(q), searchYahoo(q)]);
    console.log(`Rakuten results: ${rk.length}, Yahoo results: ${yh.length}`);
    
    const merged = [...rk, ...yh].filter(whiskyFilter);
    console.log(`After filtering: ${merged.length}`);

    const prices = merged.map(x=>x.price).filter((n): n is number => typeof n === "number");
    const { pmin, pmax } = winsorize(prices, 0.05, 0.95);

    const byKey: Record<string, RawProduct[]> = {};
    for (const p of merged) {
      const key = canonicalKey(p.title);
      (byKey[key] ||= []).push(p);
    }

    const groups: GroupedResult[] = Object.entries(byKey)
      .map(([key, arr]) => {
        if (arr.length === 0) return null;
        
        const eligible = arr
          .filter(a => a.price != null)
          .filter(a => (pmin == null || a.price! >= pmin) && (pmax == null || a.price! <= pmax));
        const sorted = (eligible.length ? eligible : arr).sort((a,b)=>(a.price ?? 9e12) - (b.price ?? 9e12));
        const cheapest = sorted[0] || arr[0];
        
        if (!cheapest) return null;
        
        return { key, cheapest, offers: arr };
      })
      .filter((item): item is GroupedResult => item !== null);

    const ranked = groups
      .sort((a,b) => {
        const ap = a.cheapest.price ?? 9e12, bp = b.cheapest.price ?? 9e12;
        if (budget) {
          const da = Math.abs(ap - budget), db = Math.abs(bp - budget);
          if (da !== db) return da - db;
        }
        return ap - bp;
      });

    console.log(`Final results: ${ranked.length}`);
    res.status(200).json({ query: q, items: ranked.slice(0, 18) });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "search_error";
    console.error('Search error:', error);
    res.status(500).json({ error });
  }
}
