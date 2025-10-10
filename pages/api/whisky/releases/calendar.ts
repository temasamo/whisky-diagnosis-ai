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

  // 指定月の範囲でフィルタ（announced_date または on_sale_date が指定月の範囲内）
  q = q.or(`and(announced_date.gte.${startDateStr},announced_date.lte.${endDateStr}),and(on_sale_date.gte.${startDateStr},on_sale_date.lte.${endDateStr})`);

  const { data, error } = await q
    .order("on_sale_date", { ascending: true, nullsFirst: false })
    .order("announced_date", { ascending: true, nullsFirst: false });

  if (error) return res.status(500).json({ error: error.message });

  // 日付ごとにグループ化
  const calendarData: Record<string, any[]> = {};
  
  (data ?? []).forEach((release: any) => {
    const releaseData = {
      id: release.id,
      brand: release.expressions?.brands?.name || 'Unknown',
      expression: release.expressions?.name || 'Unknown',
      source_type: release.source_type,
      announced_date: release.announced_date,
      on_sale_date: release.on_sale_date,
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
    if (release.on_sale_date) {
      if (!calendarData[release.on_sale_date]) {
        calendarData[release.on_sale_date] = [];
      }
      calendarData[release.on_sale_date].push({
        ...releaseData,
        type: 'on_sale'
      });
    }

    // 発表日がある場合は発表日でもグループ化（発売日と異なる場合のみ）
    if (release.announced_date && release.announced_date !== release.on_sale_date) {
      if (!calendarData[release.announced_date]) {
        calendarData[release.announced_date] = [];
      }
      calendarData[release.announced_date].push({
        ...releaseData,
        type: 'announced'
      });
    }
  });

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
