import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SUPA_URL) return res.status(500).json({ error: "SUPABASE_URL missing" });
  if (!SUPA_KEY) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" });

  const supa = createClient(SUPA_URL, SUPA_KEY);

  // クエリパラメータ
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
  const market = (req.query.market as string)?.toUpperCase() || "ALL";

  // 月の開始日と終了日を計算
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // 月の最後の日

  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // 外部キー関係が設定されていないため、別々に取得してメモリ内で結合
  let q = supa.from("releases").select("*");

  if (market !== "ALL") q = q.eq("market", market);

  // 指定月の範囲でフィルタ（announced_date または on_sale_date が指定月の範囲内）
  q = q.or(`and(announced_date.gte.${startDateStr},announced_date.lte.${endDateStr}),and(on_sale_date.gte.${startDateStr},on_sale_date.lte.${endDateStr})`);

  const { data: releases, error } = await q
    .order("on_sale_date", { ascending: true, nullsFirst: false })
    .order("announced_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Calendar releases API error:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!releases || releases.length === 0) {
    return res.status(200).json({
      calendarInfo: {
        year,
        month,
        startDate: startDateStr,
        endDate: endDateStr,
        totalDays: endDate.getDate(),
        firstDayOfWeek: startDate.getDay(),
        lastDayOfWeek: endDate.getDay(),
      },
      releases: {},
      totalReleases: 0,
      market,
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

  // 日付ごとにグループ化
  const calendarData: Record<string, any[]> = {};
  
  console.log(`📅 Calendar API: Processing ${data.length} releases for ${year}-${month}`);
  
  (data ?? []).forEach((release: any) => {
    // 日付をYYYY-MM-DD形式に正規化（タイムゾーン情報を削除）
    const normalizeDate = (dateStr: string | null): string | null => {
      if (!dateStr) return null;
      // ISO形式の日付文字列から最初の10文字（YYYY-MM-DD）を取得
      return dateStr.slice(0, 10);
    };

    const normalizedOnSaleDate = normalizeDate(release.on_sale_date);
    const normalizedAnnouncedDate = normalizeDate(release.announced_date);

    const releaseData = {
      id: release.id,
      brand: release.expressions?.brands?.name || 'Unknown',
      expression: release.expressions?.name || 'Unknown',
      source_type: release.source_type,
      announced_date: normalizedAnnouncedDate,
      on_sale_date: normalizedOnSaleDate,
      market: release.market,
      retailer: release.retailer,
      source_org: release.source_org,
      source_url: release.source_url,
      price_minor: release.price_minor,
      currency: release.currency,
      stock_status: release.stock_status,
      created_at: release.created_at,
    };

    // 発売日がある場合は発売日でグループ化
    if (normalizedOnSaleDate) {
      // 指定月の範囲内かチェック
      if (normalizedOnSaleDate >= startDateStr && normalizedOnSaleDate <= endDateStr) {
        if (!calendarData[normalizedOnSaleDate]) {
          calendarData[normalizedOnSaleDate] = [];
        }
        calendarData[normalizedOnSaleDate].push({
          ...releaseData,
          type: 'on_sale'
        });
        console.log(`  ✅ Added on_sale: ${normalizedOnSaleDate} - ${releaseData.brand} ${releaseData.expression}`);
      }
    }

    // 発表日がある場合は発表日でもグループ化（発売日と異なる場合のみ）
    if (normalizedAnnouncedDate && normalizedAnnouncedDate !== normalizedOnSaleDate) {
      // 指定月の範囲内かチェック
      if (normalizedAnnouncedDate >= startDateStr && normalizedAnnouncedDate <= endDateStr) {
        if (!calendarData[normalizedAnnouncedDate]) {
          calendarData[normalizedAnnouncedDate] = [];
        }
        calendarData[normalizedAnnouncedDate].push({
          ...releaseData,
          type: 'announced'
        });
        console.log(`  ✅ Added announced: ${normalizedAnnouncedDate} - ${releaseData.brand} ${releaseData.expression}`);
      }
    }
  });

  console.log(`📊 Calendar API: Total days with releases: ${Object.keys(calendarData).length}`);
  console.log(`📊 Calendar API: Days: ${Object.keys(calendarData).join(', ')}`);

  // カレンダー情報を生成
  const calendarInfo = {
    year,
    month,
    startDate: startDateStr,
    endDate: endDateStr,
    totalDays: endDate.getDate(),
    firstDayOfWeek: startDate.getDay(), // 0=日曜日
    lastDayOfWeek: endDate.getDay(),
  };

  res.status(200).json({
    calendarInfo,
    releases: calendarData,
    totalReleases: Object.values(calendarData).flat().length,
    market,
  });
}
