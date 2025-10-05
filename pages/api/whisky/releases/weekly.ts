import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SUPA_URL) return res.status(500).json({ error: "SUPABASE_URL missing" });
  if (!SUPA_KEY) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" });

  const supa = createClient(SUPA_URL, SUPA_KEY);

  // 今週の日付範囲を計算
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // 日曜日
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // 土曜日
  endOfWeek.setHours(23, 59, 59, 999);

  const startDate = startOfWeek.toISOString().slice(0, 10);
  const endDate = endOfWeek.toISOString().slice(0, 10);

  // ?market=ALL | JP | UK ...（指定なければ ALL）
  const market = (req.query.market as string)?.toUpperCase() || "ALL";

  let q = supa.from("releases").select(`
    *,
    expressions!inner(
      id,
      name,
      brands!inner(
        id,
        name
      )
    )
  `);
  if (market !== "ALL") q = q.eq("market", market);
  
  // 今週の範囲でフィルタ（announced_date または on_sale_date が今週の範囲内）
  q = q.or(`and(announced_date.gte.${startDate},announced_date.lte.${endDate}),and(on_sale_date.gte.${startDate},on_sale_date.lte.${endDate})`);
  
  // limit クエリ対応
  const limit = parseInt(req.query.limit as string) || 50;
  q = q.limit(limit);

  const { data, error } = await q
    .order("source_type", { ascending: true })
    .order("on_sale_date", { ascending: false, nullsFirst: false })
    .order("announced_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // サーバ側で表示用の価格文字列を作っておく（Hydration対策）
  const fmt = (m: number | null, c: string | null) =>
    m && c ? new Intl.NumberFormat("ja-JP", { style: "currency", currency: c }).format(m / 100) : null;

  // データを整形（expressions と brands の情報を統合）
  const items = (data ?? []).map((r: any) => ({
    id: r.id,
    brand: r.expressions?.brands?.name || 'Unknown',
    expression: r.expressions?.name || 'Unknown',
    source_type: r.source_type,
    announced_date: r.announced_date,
    on_sale_date: r.on_sale_date,
    market: r.market,
    retailer: r.retailer,
    source_org: r.source_org,
    source_url: r.source_url,
    price_minor: r.price_minor,
    currency: r.currency,
    stock_status: r.stock_status,
    created_at: r.created_at,
    price_display: fmt(r.price_minor, r.currency)
  }));
  res.status(200).json({ 
    items, 
    market,
    weekRange: { start: startDate, end: endDate }
  });
}
