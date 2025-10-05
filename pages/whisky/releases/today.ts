import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Row = {
  id: string;
  brand: string;
  expression: string;
  source_type: "press" | "retailer" | "db";
  announced_date?: string | null;
  on_sale_date?: string | null;
  market?: string | null;
  retailer?: string | null;
  source_org?: string | null;
  source_url?: string | null;
  price_minor?: number | null;
  currency?: string | null;
  stock_status?: string | null;
  created_at: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // server only
    );
    const { data, error } = await supabase.from("releases_view_today").select("*");
    if (error) throw error;
    res.status(200).json({ items: (data ?? []) as Row[] });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message ?? "internal error" });
  }
}
