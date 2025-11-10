import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const sort = (req.query.sort as string) || "newest";

    const offset = (page - 1) * limit;

    // 総数を取得
    const { count, error: countError } = await supabase
      .from("whisky_news")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("Count error:", countError);
      return res.status(500).json({
        error: "ニュース記事の取得に失敗しました",
        details: countError.message,
      });
    }

    // 日付カラムを動的に検出
    const { data: sampleNews } = await supabase
      .from("whisky_news")
      .select("*")
      .limit(1)
      .single();

    const dateColumn = sampleNews?.pub_date ? 'pub_date' :
                      sampleNews?.published_at ? 'published_at' :
                      sampleNews?.created_at ? 'created_at' : 'created_at';

    // ニュース記事を取得
    let query = supabase
      .from("whisky_news")
      .select("id, title, link, source, pub_date, created_at")
      .range(offset, offset + limit - 1);

    // ソート
    if (sort === "newest") {
      query = query.order(dateColumn, { ascending: false, nullsFirst: false });
    } else {
      query = query.order(dateColumn, { ascending: true, nullsFirst: false });
    }

    const { data: news, error: newsError } = await query;

    if (newsError) {
      console.error("News fetch error:", newsError);
      return res.status(500).json({
        error: "ニュース記事の取得に失敗しました",
        details: newsError.message,
      });
    }

    res.status(200).json({
      items: news || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error("News list API error:", error);
    res.status(500).json({
      error: error.message || "ニュース記事の取得に失敗しました",
      details: error,
    });
  }
}

