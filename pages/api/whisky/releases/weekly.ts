import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!SUPA_URL) return res.status(500).json({ error: "SUPABASE_URL missing" });
    if (!SUPA_KEY) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" });

    const supa = createClient(SUPA_URL, SUPA_KEY);

    // 過去7日間の日付範囲を計算（今日から過去7日間）
    const today = new Date();
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6); // 今日から6日前 = 過去7日間
    startDate.setHours(0, 0, 0, 0);

    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    // ?market=ALL | JP | UK ...（指定なければ ALL）
    const market = (req.query.market as string)?.toUpperCase() || "ALL";

    // 外部キー関係が設定されていないため、別々に取得してメモリ内で結合
    let q = supa.from("releases").select("*");
    if (market !== "ALL") q = q.eq("market", market);
    
    // 過去7日間の範囲でフィルタ（announced_date または on_sale_date が過去7日間の範囲内）
    q = q.or(`and(announced_date.gte.${startDateStr},announced_date.lte.${endDateStr}),and(on_sale_date.gte.${startDateStr},on_sale_date.lte.${endDateStr})`);
    
    // limit クエリ対応
    const limit = parseInt(req.query.limit as string) || 50;
    q = q.limit(limit);

    const { data: releases, error } = await q
      .order("source_type", { ascending: true })
      .order("on_sale_date", { ascending: false, nullsFirst: false })
      .order("announced_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error('Weekly releases API error:', error);
      return res.status(500).json({ 
        error: error.message,
        details: error,
        query: { startDateStr, endDateStr, market, limit }
      });
    }

    if (!releases || releases.length === 0) {
      return res.status(200).json({ 
        items: [], 
        market,
        weekRange: { start: startDateStr, end: endDateStr }
      });
    }

    // expression_idを取得
    const expressionIds = [...new Set(releases.map((r: any) => r.expression_id).filter(Boolean))];
    
    // expressionsを取得
    const { data: expressions } = await supa
      .from("expressions")
      .select("id, name, brand_id")
      .in("id", expressionIds);

    // brand_idを取得
    const brandIds = [...new Set((expressions || []).map((e: any) => e.brand_id).filter(Boolean))];
    
    // brandsを取得
    const { data: brands } = await supa
      .from("brands")
      .select("id, name")
      .in("id", brandIds);

    // メモリ内で結合
    const expressionsMap = new Map((expressions || []).map((e: any) => [e.id, e]));
    const brandsMap = new Map((brands || []).map((b: any) => [b.id, b]));

    const data = releases.map((r: any) => {
      const expr = expressionsMap.get(r.expression_id);
      const brand = expr ? brandsMap.get(expr.brand_id) : null;
      return {
        ...r,
        expressions: expr ? {
          ...expr,
          brands: brand
        } : null
      };
    });

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
      weekRange: { start: startDateStr, end: endDateStr }
    });
  } catch (err: any) {
    console.error('Weekly releases API exception:', err);
    return res.status(500).json({ 
      error: err.message || 'Internal server error',
      details: err.toString(),
      stack: err.stack
    });
  }
}
