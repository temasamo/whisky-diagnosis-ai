import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { convertNewsToReleases, NewsItem } from "@/lib/news-to-releases";

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
      .order("pub_date", { ascending: false });

    if (newsError) throw newsError;

    const newsItems: NewsItem[] = newsData || [];
    console.log(`Found ${newsItems.length} news items to process`);

    // ニュースをリリース情報に変換
    const releases = convertNewsToReleases(newsItems);
    console.log(`Converted ${releases.length} news items to releases`);

    if (releases.length === 0) {
      return res.status(200).json({ 
        converted: 0, 
        message: "No product releases found in recent news" 
      });
    }

    // ドライラン機能
    if (req.query.dry === "1") {
      return res.status(200).json({
        newsItems: newsItems.length,
        releases: releases.length,
        sample: releases.slice(0, 5).map(r => ({
          brand: r.brand,
          expression: r.expression,
          announced_date: r.announced_date,
          market: r.market,
          source_url: r.source_url
        }))
      });
    }

    let inserted = 0;
    let skipped = 0;

    // 各リリースをデータベースに保存
    for (const release of releases) {
      try {
        // ブランドをupsert
        const { data: brand, error: brandError } = await supabase
          .from("brands")
          .upsert({ name: release.brand }, { onConflict: "name" })
          .select("id")
          .single();

        if (brandError) {
          console.error("Brand upsert error:", brandError);
          continue;
        }

        // 表現をupsert
        const { data: expression, error: exprError } = await supabase
          .from("expressions")
          .upsert(
            { brand_id: brand!.id, name: release.expression }, 
            { onConflict: "brand_id,name" }
          )
          .select("id")
          .single();

        if (exprError) {
          console.error("Expression upsert error:", exprError);
          continue;
        }

        // リリースをupsert（制約エラーを回避するため、まずinsertを試行）
        const { error: releaseError } = await supabase
          .from("releases")
          .insert({
            expression_id: expression!.id,
            announced_date: release.announced_date,
            source_type: release.source_type,
            source_url: release.source_url,
            market: release.market,
            source_org: release.source_org,
          });

        if (releaseError) {
          console.error("Release upsert error:", releaseError);
          skipped++;
        } else {
          inserted++;
        }
      } catch (error) {
        console.error("Error processing release:", error);
        skipped++;
      }
    }

    res.status(200).json({
      newsItems: newsItems.length,
      releases: releases.length,
      inserted,
      skipped,
      message: `Successfully converted ${inserted} news items to releases`
    });

  } catch (error: any) {
    console.error("News-to-releases ETL error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to convert news to releases" 
    });
  }
}
