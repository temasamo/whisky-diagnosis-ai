import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type NewsItem = {
  id: string;
  source: string;
  brand_hint: string | null;
  title: string;
  link: string;
  pub_date: string | null;
  image_url: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // サーバー専用キーを使用
    );

    // 直近7日分のデータを取得
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await supabase
      .from("whisky_news")
      .select("id, source, brand_hint, title, link, pub_date, image_url")
      .gte("pub_date", since.toISOString())
      .order("pub_date", { ascending: false })
      .limit(50);

    if (error) throw error;

    // 表示用に軽く整形
    const items: NewsItem[] = (data || []).map((r) => ({
      ...r,
      brand_hint: r.brand_hint || "unknown",
      image_url: r.image_url,
    }));

    res.status(200).json({ 
      items, 
      count: items.length,
      dateRange: {
        start: since.toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10)
      }
    });
  } catch (e: any) {
    console.error("Weekly news API error:", e);
    res.status(500).json({ error: e?.message || "failed" });
  }
}
