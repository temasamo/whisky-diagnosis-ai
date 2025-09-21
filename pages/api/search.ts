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
  const items = (await r.json()).Items?.map((w: Record<string, unknown>)=>w.Item) || [];
  return items.map((it: Record<string, unknown>)=>({
    mall:"rakuten", id:String(it.itemCode || it.itemUrl), title: clean(it.itemName as string),
    price: Number(it.itemPrice ?? null), url: it.itemUrl as string,
    image: (it.mediumImageUrls as { imageUrl: string }[])?.[0]?.imageUrl || (it.smallImageUrls as { imageUrl: string }[])?.[0]?.imageUrl || null,
    shop: it.shopName as string || null,
    volume_ml: parseVolume(it.itemName as string), abv: parseAbv(it.itemName as string)
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
  return items.map((it: Record<string, unknown>)=>({
    mall:"yahoo", id:String(it.code || it.url), title: clean(it.name as string),
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = clean(String(req.query.q || ""));
    const budget = Number(req.query.budget || 0);
    if (!q) return res.status(400).json({ error: "q is required" });

    const [rk, yh] = await Promise.all([searchRakuten(q), searchYahoo(q)]);
    const merged = [...rk, ...yh].filter(whiskyFilter);

    const prices = merged.map(x=>x.price).filter((n): n is number => typeof n === "number");
    const { pmin, pmax } = winsorize(prices, 0.05, 0.95);

    const byKey: Record<string, RawProduct[]> = {};
    for (const p of merged) {
      const key = canonicalKey(p.title);
      (byKey[key] ||= []).push(p);
    }

    const groups = Object.entries(byKey)
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
      .filter(Boolean);

    const ranked = groups.sort((a,b) => {
      const ap = a.cheapest.price ?? 9e12, bp = b.cheapest.price ?? 9e12;
      if (budget) {
        const da = Math.abs(ap - budget), db = Math.abs(bp - budget);
        if (da !== db) return da - db;
      }
      return ap - bp;
    });

    res.json({ query: q, items: ranked.slice(0, 18) });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "search_error";
    res.status(500).json({ error });
  }
}
