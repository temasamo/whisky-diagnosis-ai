import type { NextApiRequest, NextApiResponse } from "next";
import { canonicalKey, parseVolume, parseAbv } from "@/lib/normalize";
import { winsorize } from "@/lib/price";
import { badStore } from "@/lib/stores";

type Mall = "rakuten" | "yahoo";
type RawProduct = {
  mall: Mall; id: string; title: string; price: number | null; url: string;
  image: string | null; shop?: string | null; volume_ml?: number | null; abv?: number | null;
};

const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID!;
const YAHOO_APP_ID = process.env.YAHOO_APP_ID!;
const NO_FILTER = process.env.NO_FILTER === "1";

const clean = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();

async function searchRakuten(q: string): Promise<RawProduct[]> {
  const u = new URL("https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601");
  u.searchParams.set("format","json"); 
  u.searchParams.set("applicationId", RAKUTEN_APP_ID);
  u.searchParams.set("keyword", q); 
  u.searchParams.set("hits","30"); 
  u.searchParams.set("imageFlag","1");
  u.searchParams.set("sort","+itemPrice");
  const r = await fetch(u.toString()); 
  if (!r.ok) throw new Error(`rakuten ${r.status}`);
  const items = (await r.json()).Items?.map((w:any)=>w.Item) || [];
  return items.map((it:any)=>({
    mall:"rakuten", id:String(it.itemCode || it.itemUrl), title: clean(it.itemName),
    price: Number(it.itemPrice ?? null), url: it.itemUrl,
    image: it.mediumImageUrls?.[0]?.imageUrl || it.smallImageUrls?.[0]?.imageUrl || null,
    shop: it.shopName || null,
    volume_ml: parseVolume(it.itemName), abv: parseAbv(it.itemName)
  }));
}

async function searchYahoo(q: string): Promise<RawProduct[]> {
  const u = new URL("https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch");
  u.searchParams.set("appid", YAHOO_APP_ID); 
  u.searchParams.set("query", q);
  u.searchParams.set("results","30"); 
  u.searchParams.set("sort","+price");
  const r = await fetch(u.toString()); 
  if (!r.ok) throw new Error(`yahoo ${r.status}`);
  const items = (await r.json()).hits || [];
  return items.map((it:any)=>({
    mall:"yahoo", id:String(it.code || it.url), title: clean(it.name),
    price: Number(it.price ?? it.priceLabel?.defaultPrice ?? null), url: it.url,
    image: it.image?.medium || it.image?.small || null, shop: it.seller?.name || null,
    volume_ml: parseVolume(it.name), abv: parseAbv(it.name)
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = clean(String(req.query.q || ""));
    const budget = Number(req.query.budget || 0); // 表示順の補助
    if (!q) return res.status(400).json({ error: "q is required" });

    const [rk, yh] = await Promise.all([searchRakuten(q), searchYahoo(q)]);
    const merged = [...rk, ...yh].filter(whiskyFilter);

    // 外れ値抑制のため、全体価格分布からWinsorize域を取得
    const prices = merged.map(x=>x.price).filter((n): n is number => typeof n === "number");
    const { pmin, pmax } = winsorize(prices, 0.05, 0.95);

    // 重複グルーピング
    const byKey: Record<string, RawProduct[]> = {};
    for (const p of merged) {
      const key = canonicalKey(p.title);
      (byKey[key] ||= []).push(p);
    }

    // グループごとに最安を決定（Winsorize域外は除外優先）
    const groups = Object.entries(byKey).map(([key, arr]) => {
      const eligible = arr
        .filter(a => a.price != null)
        .filter(a => (pmin == null || a.price! >= pmin) && (pmax == null || a.price! <= pmax));
      const sorted = (eligible.length ? eligible : arr).sort((a,b)=>(a.price ?? 9e12) - (b.price ?? 9e12));
      const cheapest = sorted[0] || arr[0];
      return { key, cheapest, offers: arr };
    });

    // 並び順：予算に近い最安→価格昇順→レビューなど（今は価格のみ）
    const ranked = groups.sort((a,b) => {
      const ap = a.cheapest.price ?? 9e12, bp = b.cheapest.price ?? 9e12;
      if (budget) {
        const da = Math.abs(ap - budget), db = Math.abs(bp - budget);
        if (da !== db) return da - db;
      }
      return ap - bp;
    });

    res.json({ query: q, items: ranked.slice(0, 18) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "search_error" });
  }
}
