import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // サーバ専用

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!SUPA_URL) return res.status(500).json({ error: "SUPABASE_URL missing" });
    if (!SUPA_KEY) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" });

    const supa = createClient(SUPA_URL, SUPA_KEY);

    // ?market=ALL | JP | UK ...（指定なければ ALL）
    const market = (req.query?.market as string)?.toUpperCase() || "ALL";

    const today = new Date().toISOString().slice(0, 10);
    
    // 外部キー関係が設定されていないため、別々に取得してメモリ内で結合
    let q = supa
      .from("releases")
      .select("*")
      .or(`announced_date.eq.${today},on_sale_date.eq.${today}`);
    
    if (market !== "ALL") q = q.eq("market", market);
    
    // limit クエリ対応
    const limit = parseInt(req.query?.limit as string) || 50;
    q = q.limit(limit);

    const { data: releases, error } = await q
      .order("on_sale_date", { ascending: false, nullsFirst: false })
      .order("announced_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error('Today releases API error:', error);
      return res.status(500).json({ 
        error: error.message,
        details: error,
        query: { today, market, limit }
      });
    }

    if (!releases || releases.length === 0) {
      return res.status(200).json({ items: [], market });
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
      .select("id, name, region")
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

    const items = (data ?? []).map((r: any) => ({ 
      ...r, 
      price_display: fmt(r.price_minor, r.currency),
      expression_name: r.expressions?.name,
      brand_name: r.expressions?.brands?.name,
      brand_region: r.expressions?.brands?.region
    }));
    res.status(200).json({ items, market });
  } catch (err: any) {
    console.error('Today releases API exception:', err);
    return res.status(500).json({ 
      error: err.message || 'Internal server error',
      details: err.toString(),
      stack: err.stack
    });
  }
}