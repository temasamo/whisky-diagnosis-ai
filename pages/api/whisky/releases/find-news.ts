import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { releaseId } = req.query;

    // リリース情報を取得
    let releases: any[] = [];
    
    if (releaseId && typeof releaseId === "string") {
      // 特定のリリースIDを取得
      const { data: release, error: releaseError } = await supabase
        .from("releases")
        .select(`
          id,
          on_sale_date,
          announced_date,
          created_at,
          expression_id
        `)
        .eq("id", releaseId)
        .single();

      if (releaseError) {
        return res.status(404).json({
          error: "リリース情報が見つかりません",
          details: releaseError.message,
        });
      }

      releases = [release];
    } else {
      // 全リリース情報を取得
      const { data: allReleases, error: releasesError } = await supabase
        .from("releases")
        .select(`
          id,
          on_sale_date,
          announced_date,
          created_at,
          expression_id
        `)
        .order("created_at", { ascending: false });

      if (releasesError) {
        return res.status(500).json({
          error: "リリース情報の取得に失敗しました",
          details: releasesError.message,
        });
      }

      releases = allReleases || [];
    }

    // expression_idを取得
    const expressionIds = [...new Set(releases.map((r: any) => r.expression_id).filter(Boolean))];
    
    // expressionsを取得
    let expressions: any[] = [];
    if (expressionIds.length > 0) {
      const { data: exprs } = await supabase
        .from("expressions")
        .select("id, name, brand_id")
        .in("id", expressionIds);
      expressions = exprs || [];
    }

    // brand_idを取得
    const brandIds = [...new Set(expressions.map((e: any) => e.brand_id).filter(Boolean))];
    
    // brandsを取得
    let brands: any[] = [];
    if (brandIds.length > 0) {
      const { data: brds } = await supabase
        .from("brands")
        .select("id, name")
        .in("id", brandIds);
      brands = brds || [];
    }

    // メモリ内で結合
    const expressionsMap = new Map(expressions.map((e: any) => [e.id, e]));
    const brandsMap = new Map(brands.map((b: any) => [b.id, b]));

    // リリース情報にexpressionsとbrandsを結合
    const releasesWithRelations = releases.map((r: any) => {
      const expr = r.expression_id ? expressionsMap.get(r.expression_id) : null;
      const brand = expr && expr.brand_id ? brandsMap.get(expr.brand_id) : null;
      
      return {
        ...r,
        brand_name: brand?.name || null,
        expression_name: expr?.name || null,
      };
    });

    // 各リリースについてニュース記事を検索
    const results = await Promise.all(
      releasesWithRelations.map(async (release: any) => {
        const brandName = release.brand_name || "";
        const expressionName = release.expression_name || "";
        
        // 検索キーワードを生成
        const searchKeywords: string[] = [];
        
        // ブランド名を追加（日本語・英語両方）
        if (brandName) {
          searchKeywords.push(brandName);
          // サントリー → サントリー、Suntory
          if (brandName.toLowerCase().includes("suntory")) {
            searchKeywords.push("サントリー");
          }
          if (brandName.toLowerCase().includes("サントリー")) {
            searchKeywords.push("Suntory");
          }
        }
        
        // 商品名を追加（主要な部分のみ）
        if (expressionName) {
          // 商品名が長すぎる場合は最初の部分だけ使用
          const shortExpression = expressionName.length > 20 
            ? expressionName.substring(0, 20) 
            : expressionName;
          searchKeywords.push(shortExpression);
          
          // 商品名から主要なキーワードを抽出（例：「山崎 12年」→「山崎」「12年」）
          const parts = shortExpression.split(/\s+/);
          searchKeywords.push(...parts.filter(p => p.length > 1));
        }

        // 発売日を取得（検索範囲の基準日として使用）
        const releaseDate = release.on_sale_date || release.announced_date || release.created_at;
        const releaseDateStr = releaseDate ? new Date(releaseDate).toISOString().slice(0, 10) : null;

        // ニュース記事を検索
        let matchedNews: any[] = [];
        
        if (searchKeywords.length > 0) {
          // 各キーワードで検索（OR条件）
          const searchQueries = searchKeywords.map(keyword => 
            `title.ilike.%${keyword}%`
          );

          // Supabaseでは複数のOR条件を直接指定できないため、複数回検索して結合
          const allMatches = new Map<string, any>();
          
          for (const keyword of searchKeywords.slice(0, 5)) { // 最大5つのキーワードで検索
            const { data: newsItems } = await supabase
              .from("whisky_news")
              .select("id, title, link")
              .ilike("title", `%${keyword}%`)
              .limit(20);
            
            if (newsItems) {
              newsItems.forEach((item: any) => {
                if (!allMatches.has(item.id)) {
                  allMatches.set(item.id, item);
                }
              });
            }
          }

          matchedNews = Array.from(allMatches.values());

          // 発売日に近い記事を優先的にソート
          if (releaseDateStr && matchedNews.length > 0) {
            // ニュース記事の日付カラムを確認（pub_date, published_at, created_atのいずれか）
            const { data: sampleNews } = await supabase
              .from("whisky_news")
              .select("*")
              .eq("id", matchedNews[0].id)
              .single();

            const dateColumn = sampleNews?.pub_date ? 'pub_date' :
                              sampleNews?.published_at ? 'published_at' :
                              sampleNews?.created_at ? 'created_at' : 'created_at';

            // 日付情報を取得してソート
            const newsWithDates = await Promise.all(
              matchedNews.map(async (item: any) => {
                const { data: newsItem } = await supabase
                  .from("whisky_news")
                  .select(`id, title, link, ${dateColumn}`)
                  .eq("id", item.id)
                  .single();
                
                return newsItem;
              })
            );

            // 発売日に近い順にソート
            matchedNews = newsWithDates
              .filter(Boolean)
              .sort((a: any, b: any) => {
                const dateA = a[dateColumn] ? new Date(a[dateColumn]).getTime() : 0;
                const dateB = b[dateColumn] ? new Date(b[dateColumn]).getTime() : 0;
                const releaseDateNum = releaseDateStr ? new Date(releaseDateStr).getTime() : 0;
                
                const diffA = Math.abs(dateA - releaseDateNum);
                const diffB = Math.abs(dateB - releaseDateNum);
                
                return diffA - diffB; // 発売日に近い順
              })
              .slice(0, 5); // 上位5件まで
          } else {
            matchedNews = matchedNews.slice(0, 5);
          }
        }

        return {
          release_id: release.id,
          brand_name: brandName,
          expression_name: expressionName,
          on_sale_date: release.on_sale_date,
          announced_date: release.announced_date,
          matched_news_count: matchedNews.length,
          matched_news: matchedNews.map((item: any) => ({
            id: item.id,
            title: item.title,
            link: item.link,
          })),
        };
      })
    );

    res.status(200).json({
      total_releases: results.length,
      results: results,
      message: `${results.length}件のリリース情報についてニュース記事を検索しました`,
    });
  } catch (error: any) {
    console.error("Find news error:", error);
    res.status(500).json({
      error: error.message || "ニュース記事の検索に失敗しました",
      details: error,
    });
  }
}

