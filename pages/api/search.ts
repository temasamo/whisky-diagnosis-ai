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

// 検索語を最適化（診断結果に基づいた検索クエリを生成）
function optimizeQuery(q: string): string {
  let optimized = q.toLowerCase();
  
  // 地域名を英語に変換（検索精度向上）
  optimized = optimized.replace(/スペイサイド/g, 'speyside');
  optimized = optimized.replace(/アイラ/g, 'islay');
  optimized = optimized.replace(/ハイランド/g, 'highland');
  optimized = optimized.replace(/ローランド/g, 'lowland');
  optimized = optimized.replace(/キャンベルタウン/g, 'campbeltown');
  optimized = optimized.replace(/ジャパニーズ/g, 'japanese');
  
  // ピート関連のキーワードを保持
  optimized = optimized.replace(/ピート控えめ/g, 'light peat');
  optimized = optimized.replace(/ピート/g, 'peat');
  optimized = optimized.replace(/ノンピート/g, 'no peat');
  optimized = optimized.replace(/スモーキー/g, 'smoky');
  
  // 味わいのキーワードを保持
  optimized = optimized.replace(/フルーティ/g, 'fruity');
  optimized = optimized.replace(/バランス/g, 'balanced');
  
  // 用途と価格帯を削除（検索を広げるため）
  optimized = optimized.replace(/自分で飲む/g, '');
  optimized = optimized.replace(/ギフト/g, '');
  optimized = optimized.replace(/プレゼント/g, '');
  optimized = optimized.replace(/〜\d+円/g, '');
  optimized = optimized.replace(/\d+ml/g, '');
  optimized = optimized.replace(/（標準）/g, '');
  optimized = optimized.replace(/（フルーティ）/g, '');
  optimized = optimized.replace(/（スモーキー）/g, '');
  optimized = optimized.replace(/（バランス）/g, '');
  
  // 余分な空白を整理
  optimized = optimized.replace(/\s+/g, ' ').trim();
  
  // ウイスキーキーワードを追加
  if (!optimized.includes('whisky') && !optimized.includes('ウイスキー')) {
    optimized = `whisky ${optimized}`;
  }
  
  // 空になった場合は基本的な検索語にフォールバック
  if (!optimized || optimized.length < 3) {
    return 'whisky';
  }
  
  // 検索クエリが複雑すぎる場合は、主要なキーワードのみに絞る
  const keywords = optimized.split(' ').filter(word => 
    word.length > 2 && 
    !word.includes('（') && 
    !word.includes('）') &&
    !word.includes('〜') &&
    !word.includes('円') &&
    !word.includes('なし') &&
    !word.includes('控えめ')
  );
  
  // 最大2つのキーワードに絞る（シンプルに）
  if (keywords.length > 2) {
    return keywords.slice(0, 2).join(' ');
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
    
    // 診断結果に基づいた検索クエリを生成
    const searchQuery = optimizeQuery(q);
    console.log(`Optimized query: ${searchQuery}`);

    // Yahoo API障害対応: 楽天APIのみで動作
    let rk: RawProduct[] = [];
    let yh: RawProduct[] = [];
    
    try {
      rk = await searchRakuten(searchQuery);
      console.log(`Rakuten results: ${rk.length}`);
    } catch (error) {
      console.error('Rakuten API error:', error);
    }
    
    try {
      yh = await searchYahoo(searchQuery);
      console.log(`Yahoo results: ${yh.length}`);
    } catch (error) {
      console.error('Yahoo API error (可能な障害):', error);
      // Yahoo API障害時は楽天のみで継続
    }
    
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
