import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supa = createClient(url, key);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
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

  // 今週の範囲でカウント
  const { count: c1 } = await supa
    .from("releases")
    .select("*", { count: "exact", head: true })
    .gte("announced_date", startDate)
    .lte("announced_date", endDate);
    
  const { count: c2 } = await supa
    .from("releases")
    .select("*", { count: "exact", head: true })
    .gte("on_sale_date", startDate)
    .lte("on_sale_date", endDate);

  res.status(200).json({ 
    weeklyCount: (c1 ?? 0) + (c2 ?? 0),
    weekRange: { start: startDate, end: endDate }
  });
}
