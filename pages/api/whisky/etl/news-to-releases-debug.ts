import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { convertNewsToReleases, NewsItem, isProductRelease, extractBrand, extractExpression } from "@/lib/news-to-releases";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 直近7日分のニュースを取得
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data: newsData, error: newsError } = await supabase
      .from("whisky_news")
      .select("id, source, brand_hint, title, link, pub_date, image_url")
      .gte("pub_date", since.toISOString())
      .order("pub_date", { ascending: false })
      .limit(20); // デバッグ用に制限

    if (newsError) throw newsError;

    const newsItems: NewsItem[] = newsData || [];
    
    // 各ニュースアイテムの分析結果
    const analysis = newsItems.map(item => {
      const isRelease = isProductRelease(item.title);
      const brand = extractBrand(item.title);
      const expression = brand ? extractExpression(item.title, brand) : null;
      
      return {
        id: item.id,
        title: item.title,
        source: item.source,
        pub_date: item.pub_date,
        isProductRelease: isRelease,
        extractedBrand: brand,
        extractedExpression: expression,
        link: item.link
      };
    });

    // 商品リリースに変換可能なアイテム
    const releases = convertNewsToReleases(newsItems);

    res.status(200).json({
      totalNewsItems: newsItems.length,
      productReleases: releases.length,
      analysis,
      sampleReleases: releases.slice(0, 5),
      message: `Found ${releases.length} product releases out of ${newsItems.length} news items`
    });

  } catch (error: any) {
    console.error("News-to-releases debug error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to analyze news items" 
    });
  }
}
