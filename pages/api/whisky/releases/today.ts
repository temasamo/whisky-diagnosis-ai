import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // サーバ専用

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SUPA_URL) return res.status(500).json({ error: "SUPABASE_URL missing" });
  if (!SUPA_KEY) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" });

  const supa = createClient(SUPA_URL, SUPA_KEY);

  // ?market=ALL | JP | UK ...（指定なければ ALL）
  const market = (req.query?.market as string)?.toUpperCase() || "ALL";

  const today = new Date().toISOString().slice(0, 10);
  
  // ビューの代わりに直接JOINクエリを使用
  let q = supa
    .from("releases")
    .select(`
      *,
      expressions!inner(
        id,
        name,
        brand_id,
        brands!inner(
          id,
          name,
          region
        )
      )
    `)
    .or(`announced_date.eq.${today},on_sale_date.eq.${today}`);
  
  if (market !== "ALL") q = q.eq("market", market);
  
  // limit クエリ対応
  const limit = parseInt(req.query?.limit as string) || 50;
  q = q.limit(limit);

  const { data, error } = await q
    .order("on_sale_date", { ascending: false, nullsFirst: false })
    .order("announced_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // サーバ側で表示用の価格文字列を作っておく（Hydration対策）
  const fmt = (m: number | null, c: string | null) =>
    m && c ? new Intl.NumberFormat("ja-JP", { style: "currency", currency: c }).format(m / 100) : null;

  const items = (data ?? []).map((r: any) => ({ 
    ...r, 
    price_display: fmt(r.price_minor, r.currency),
    expression_name: r.expressions?.name,
    brand_name: r.expressions?.brands?.name,
    brand_region: r.expressions?.brands?.region
  }));
  res.status(200).json({ items, market });
}