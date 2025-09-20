import type { NextApiRequest, NextApiResponse } from "next";

type Mall = "rakuten" | "yahoo";
type Product = {
  mall: Mall;
  id: string;
  title: string;
  price: number | null;
  url: string;
  image: string | null;
  brand?: string | null;
  volume_ml?: number | null;
  abv?: number | null;
};

const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID!;
const YAHOO_APP_ID = process.env.YAHOO_APP_ID!;
const NO_FILTER = process.env.NO_FILTER === "1";

const take = (arr: unknown[], n: number) => arr.slice(0, n);
const clean = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();

const parseVolume = (t: string): number | null => {
  const m = t.match(/(\d{2,4})\s?m?l/i);
  return m ? Math.max(50, Math.min(5000, parseInt(m[1], 10))) : null;
};
const parseAbv = (t: string): number | null => {
  const m = t.match(/(\d{1,2}(?:\.\d)?)\s?%/);
  return m ? Math.round(parseFloat(m[1]) * 10) / 10 : null;
};

// 楽天
async function searchRakuten(q: string): Promise<Product[]> {
  const u = new URL("https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601");
  u.searchParams.set("format", "json");
  u.searchParams.set("applicationId", RAKUTEN_APP_ID);
  u.searchParams.set("keyword", q);
  u.searchParams.set("hits", "30");
  u.searchParams.set("imageFlag", "1");
  u.searchParams.set("sort", "+itemPrice");

  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`rakuten ${r.status}`);
  const j = await r.json() as { Items?: { Item: Record<string, unknown> }[] };

  const items = (j.Items || []).map((w) => w.Item);
  return items.map((it: Record<string, unknown>): Product => {
    const title = clean(it.itemName as string);
    return {
      mall: "rakuten",
      id: String(it.itemCode || it.itemUrl),
      title,
      price: Number(it.itemPrice ?? null),
      url: it.itemUrl as string,
      image: (it.mediumImageUrls as { imageUrl: string }[])?.[0]?.imageUrl || (it.smallImageUrls as { imageUrl: string }[])?.[0]?.imageUrl || null,
      brand: null,
      volume_ml: parseVolume(title),
      abv: parseAbv(title),
    };
  });
}

// Yahoo
async function searchYahoo(q: string): Promise<Product[]> {
  const u = new URL("https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch");
  u.searchParams.set("appid", YAHOO_APP_ID);
  u.searchParams.set("query", q);
  u.searchParams.set("results", "30");
  u.searchParams.set("sort", "+price");

  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`yahoo ${r.status}`);
  const j = await r.json() as { hits?: Record<string, unknown>[] };

  const items = j.hits || [];
  return items.map((it: Record<string, unknown>): Product => {
    const title = clean(it.name as string);
    return {
      mall: "yahoo",
      id: String(it.code || it.url),
      title,
      price: Number(it.price ?? (it.priceLabel as { defaultPrice: number })?.defaultPrice ?? null),
      url: it.url as string,
      image: (it.image as { medium?: string; small?: string })?.medium || (it.image as { medium?: string; small?: string })?.small || null,
      brand: (it.brand as { name: string })?.name ?? null,
      volume_ml: parseVolume(title),
      abv: parseAbv(title),
    };
  });
}

function whiskyFilter(p: Product): boolean {
  if (NO_FILTER) return true;
  const t = p.title.toLowerCase();
  if (/(日本酒|清酒|焼酎|ビール|ワイン|梅酒|スパークリング)/.test(t)) return false;
  if (!/(ウイスキー|whisky|whiskey)/.test(t)) return false;
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = clean(String(req.query.q || ""));
    if (!q) return res.status(400).json({ error: "q is required" });

    const [rk, yh] = await Promise.all([searchRakuten(q), searchYahoo(q)]);
    const merged = [...rk, ...yh]
      .filter(whiskyFilter)
      .sort((a, b) => (a.price ?? 9e9) - (b.price ?? 9e9));

    res.json({ query: q, count: merged.length, items: take(merged, 20) });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "search_error";
    res.status(500).json({ error });
  }
}
