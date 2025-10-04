import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supa = createClient(url, key);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const today = new Date().toISOString().slice(0,10);
  // announced_date or on_sale_date が今日
  const { count: c1 } = await supa.from("releases").select("*", { count: "exact", head: true }).eq("announced_date", today);
  const { count: c2 } = await supa.from("releases").select("*", { count: "exact", head: true }).eq("on_sale_date", today);
  res.status(200).json({ todayCount: (c1 ?? 0) + (c2 ?? 0) });
}
