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
          on_sale_date: r.on_sale_date
        }))
      });
    }

    let inserted = 0;
    let skipped = 0;
    const errors: any[] = [];

    console.log(`Processing ${releases.length} releases...`);

    // 各リリースをデータベースに保存
    for (const release of releases) {
      console.log(`Processing release: ${release.brand} - ${release.expression}`);
      try {
        // ブランドを取得または作成
        let { data: brand, error: brandError } = await supabase
          .from("brands")
          .select("id")
          .eq("name", release.brand)
          .single();

        if (brandError && brandError.code === "PGRST116") {
          // ブランドが存在しない場合は作成
          const { data: newBrand, error: createError } = await supabase
            .from("brands")
            .insert({ name: release.brand })
            .select("id")
            .single();
          
          if (createError) {
            console.error("Brand create error:", createError);
            errors.push({ type: "brand", error: createError.message, brand: release.brand });
            skipped++;
            continue;
          }
          brand = newBrand;
        } else if (brandError) {
          console.error("Brand select error:", brandError);
          errors.push({ type: "brand", error: brandError.message, brand: release.brand });
          skipped++;
          continue;
        }

        if (!brand) {
          console.error("Brand not found and could not be created");
          skipped++;
          continue;
        }

        // 表現を取得または作成
        let { data: expression, error: exprError } = await supabase
          .from("expressions")
          .select("id")
          .eq("brand_id", brand.id)
          .eq("name", release.expression)
          .single();

        if (exprError && exprError.code === "PGRST116") {
          // 表現が存在しない場合は作成
          const { data: newExpr, error: createError } = await supabase
            .from("expressions")
            .insert({ brand_id: brand.id, name: release.expression })
            .select("id")
            .single();
          
          if (createError) {
            console.error("Expression create error:", createError);
            errors.push({ type: "expression", error: createError.message, brand: release.brand, expression: release.expression });
            skipped++;
            continue;
          }
          expression = newExpr;
        } else if (exprError) {
          console.error("Expression select error:", exprError);
          errors.push({ type: "expression", error: exprError.message, brand: release.brand, expression: release.expression });
          skipped++;
          continue;
        }

        if (!expression) {
          console.error("Expression not found and could not be created");
          skipped++;
          continue;
        }

        // リリースをupsert（制約エラーを回避するため、まずinsertを試行）
        const { error: releaseError } = await supabase
          .from("releases")
          .insert({
            expression_id: expression!.id,
            announced_date: release.announced_date,
            on_sale_date: release.on_sale_date,
            source_type: release.source_type,
          });

        if (releaseError) {
          console.error("Release insert error:", releaseError);
          console.error("Release data:", {
            expression_id: expression!.id,
            announced_date: release.announced_date,
            on_sale_date: release.on_sale_date,
            source_type: release.source_type,
            source_org: release.source_org,
          });
          errors.push({ 
            type: "release", 
            error: releaseError.message, 
            code: releaseError.code,
            brand: release.brand, 
            expression: release.expression 
          });
          skipped++;
        } else {
          inserted++;
        }
      } catch (error: any) {
        console.error("Error processing release:", error);
        console.error("Error details:", error.message, error.stack);
        skipped++;
      }
    }

    res.status(200).json({
      newsItems: newsItems.length,
      releases: releases.length,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      message: `Successfully converted ${inserted} news items to releases${errors.length > 0 ? `, ${skipped} skipped due to errors` : ""}`
    });

  } catch (error: any) {
    console.error("News-to-releases ETL error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to convert news to releases" 
    });
  }
}
