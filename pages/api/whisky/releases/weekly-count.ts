import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supa = createClient(url, key);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // 過去7日間の日付範囲を計算（今日から過去7日間）
  const today = new Date();
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);
  
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 6); // 今日から6日前 = 過去7日間
  startDate.setHours(0, 0, 0, 0);

  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // 過去7日間の範囲でカウント
  const { count: c1 } = await supa
    .from("releases")
    .select("*", { count: "exact", head: true })
    .gte("announced_date", startDateStr)
    .lte("announced_date", endDateStr);
    
  const { count: c2 } = await supa
    .from("releases")
    .select("*", { count: "exact", head: true })
    .gte("on_sale_date", startDateStr)
    .lte("on_sale_date", endDateStr);

  res.status(200).json({ 
    weeklyCount: (c1 ?? 0) + (c2 ?? 0),
    weekRange: { start: startDateStr, end: endDateStr }
  });
}
