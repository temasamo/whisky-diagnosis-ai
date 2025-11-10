import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  convertNewsToReleases,
  NewsItem,
  isWhiskyProductRelease,
  extractBrand,
  extractReleaseDate,
} from "@/lib/news-to-releases";

/**
 * 発売情報の取得状況を確認するAPI
 * 
 * 確認項目：
 * 1. ニュース記事の総数
 * 2. 商品リリースとして判定されたニュース数
 * 3. 発売日が抽出できたニュース数
 * 4. リリース情報に変換できた数
 * 5. データベースに保存されているリリース数
 * 6. 発売日が抽出できなかったニュースのリスト
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 期間を指定（デフォルトは直近30日）
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 1. ニュース記事を取得（カラム名が不明なため、まず全カラムを取得してからフィルタ）
    // まずは全データを取得して、日付でフィルタリング
    const { data: allNewsData, error: allNewsError } = await supabase
      .from("whisky_news")
      .select("*")
      .limit(1000); // 一時的に制限を設ける

    if (allNewsError) {
      // テーブルが存在しない、またはアクセス権限がない場合
      return res.status(500).json({
        error: "whisky_newsテーブルにアクセスできません",
        details: allNewsError.message,
        hint: "テーブルが存在するか、カラム名が正しいか確認してください",
      });
    }

    // 実際のカラム名を確認
    const firstItem = allNewsData && allNewsData.length > 0 ? allNewsData[0] : null;
    if (!firstItem) {
      return res.status(200).json({
        summary: {
          period: `${days}日間`,
          healthScore: 0,
          status: "❌ 問題あり",
          totalNews: 0,
          message: "ニュース記事が存在しません",
        },
        message: "ニュース記事が存在しません。RSSフィード取得APIを実行してください。",
      });
    }

    // カラム名のマッピング（実際のカラム名を推測）
    const dateColumn = firstItem.pub_date ? 'pub_date' : 
                      firstItem.published_at ? 'published_at' :
                      firstItem.created_at ? 'created_at' : null;
    
    const sourceColumn = firstItem.source ? 'source' : null;
    const titleColumn = firstItem.title ? 'title' : null;
    const linkColumn = firstItem.link ? 'link' : firstItem.url ? 'url' : null;

    if (!dateColumn) {
      return res.status(500).json({
        error: "日付カラムが見つかりません",
        availableColumns: Object.keys(firstItem),
        hint: "テーブルのカラム名を確認してください",
      });
    }

    // 日付でフィルタリング（メモリ内で）
    const newsData = (allNewsData || []).filter((item: any) => {
      const itemDate = item[dateColumn];
      if (!itemDate) return false;
      const itemDateStr = new Date(itemDate).toISOString();
      return itemDateStr >= since.toISOString();
    });

    // sourceカラムが存在するかチェック
    const hasSourceColumn = sourceColumn !== null;
    
    const newsItems: NewsItem[] = newsData.map((item: any) => ({
      id: item.id,
      source: hasSourceColumn ? (item[sourceColumn || ''] || 'unknown') : 'unknown',
      brand_hint: item.brand_hint || null,
      title: item[titleColumn || ''] || '',
      link: item[linkColumn || ''] || '',
      pub_date: item[dateColumn] || null,
      image_url: item.image_url || null,
    }));
    
    const totalNews = newsItems.length;

    // 2. 各ニュースの分析
    const analysis = newsItems.map((item) => {
      const isRelease = isWhiskyProductRelease(item.title);
      const brand = extractBrand(item.title);
      const releaseDate = extractReleaseDate(item.title);
      const canConvert = isRelease && brand !== null;

      return {
        id: item.id,
        title: item.title,
        source: item.source,
        pub_date: item.pub_date,
        isWhiskyProductRelease: isRelease,
        extractedBrand: brand,
        extractedReleaseDate: releaseDate,
        canConvertToRelease: canConvert,
        link: item.link,
      };
    });

    // 3. 統計情報
    const whiskyProductReleases = analysis.filter((a) => a.isWhiskyProductRelease).length;
    const withReleaseDate = analysis.filter((a) => a.extractedReleaseDate !== null).length;
    const canConvert = analysis.filter((a) => a.canConvertToRelease).length;
    const withoutReleaseDate = analysis.filter(
      (a) => a.isWhiskyProductRelease && a.extractedReleaseDate === null
    );

    // 4. リリース情報に変換
    const releases = convertNewsToReleases(newsItems);
    const convertedCount = releases.length;
    const withOnSaleDate = releases.filter((r) => r.on_sale_date).length;

    // 5. データベースに保存されているリリース数を確認
    const { data: dbReleases, error: dbError } = await supabase
      .from("releases")
      .select("id, on_sale_date, announced_date, source_url, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("Database query error:", dbError);
    }

    const dbReleasesCount = dbReleases?.length || 0;
    const dbReleasesWithDate = dbReleases?.filter((r) => r.on_sale_date).length || 0;

    // 6. 発売日が抽出できなかったニュースの詳細
    const missingReleaseDate = withoutReleaseDate.map((a) => ({
      title: a.title,
      source: a.source,
      pub_date: a.pub_date,
      link: a.link,
      brand: a.extractedBrand,
    }));

    // 7. リリース情報に変換できなかったニュース
    const failedConversions = analysis
      .filter((a) => a.isWhiskyProductRelease && !a.canConvertToRelease)
      .map((a) => ({
        title: a.title,
        source: a.source,
        pub_date: a.pub_date,
        link: a.link,
        reason: a.extractedBrand === null ? "ブランド名が抽出できなかった" : "その他",
      }));

    // 8. 健康度スコア（0-100）
    const healthScore = (() => {
      let score = 0;
      // ニュース記事があるか（30点）
      if (totalNews > 0) score += 30;
      // 商品リリースが検出できているか（30点）
      if (whiskyProductReleases > 0) score += 30;
      // 発売日が抽出できているか（20点）
      if (withReleaseDate > 0) score += 20;
      // データベースに保存されているか（20点）
      if (dbReleasesCount > 0) score += 20;
      return score;
    })();

    // 9. 問題点と改善提案
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (totalNews === 0) {
      issues.push("❌ ニュース記事が取得できていません");
      recommendations.push("RSSフィード取得API（/api/whisky/etl/suntory など）を実行してください");
    } else if (totalNews < 10) {
      issues.push("⚠️ ニュース記事が少ないです（" + totalNews + "件）");
      recommendations.push("RSSフィードの取得頻度を上げるか、フィードURLを確認してください");
    }

    if (whiskyProductReleases === 0 && totalNews > 0) {
      issues.push("❌ 商品リリースとして判定されたニュースがありません");
      recommendations.push("ニュース記事のタイトルに「発売」「新商品」などのキーワードが含まれているか確認してください");
    }

    if (withReleaseDate === 0 && whiskyProductReleases > 0) {
      issues.push("❌ 発売日が抽出できていません");
      recommendations.push("ニュース記事のタイトルに「12月2日」などの日付表記が含まれているか確認してください");
    }

    if (dbReleasesCount === 0 && convertedCount > 0) {
      issues.push("❌ リリース情報がデータベースに保存されていません");
      recommendations.push("/api/whisky/etl/news-to-releases を実行してリリース情報を保存してください");
    }

    if (dbReleasesCount < convertedCount) {
      issues.push("⚠️ 一部のリリース情報がデータベースに保存されていません");
      recommendations.push("重複チェックやエラーログを確認してください");
    }

    // 10. サマリー
    const summary = {
      period: `${days}日間`,
      healthScore: healthScore,
      status: healthScore >= 80 ? "✅ 良好" : healthScore >= 50 ? "⚠️ 要改善" : "❌ 問題あり",
      totalNews: totalNews,
      whiskyProductReleases: whiskyProductReleases,
      withReleaseDate: withReleaseDate,
      withoutReleaseDate: withoutReleaseDate.length,
      canConvertToRelease: canConvert,
      convertedToReleases: convertedCount,
      withOnSaleDate: withOnSaleDate,
      dbReleasesCount: dbReleasesCount,
      dbReleasesWithDate: dbReleasesWithDate,
      conversionRate: totalNews > 0 ? ((convertedCount / totalNews) * 100).toFixed(2) + "%" : "0%",
      releaseDateExtractionRate:
        whiskyProductReleases > 0
          ? ((withReleaseDate / whiskyProductReleases) * 100).toFixed(2) + "%"
          : "0%",
      issues: issues,
      recommendations: recommendations,
    };

    res.status(200).json({
      summary,
      missingReleaseDate: missingReleaseDate.slice(0, 20), // 最大20件
      failedConversions: failedConversions.slice(0, 20), // 最大20件
      sampleReleases: releases.slice(0, 10), // サンプル10件
      message: `
📊 発売情報取得状況レポート

【健康度スコア】${healthScore}/100 ${summary.status}

期間: 直近${days}日間
ニュース記事総数: ${totalNews}件
商品リリースとして判定: ${whiskyProductReleases}件
発売日抽出成功: ${withReleaseDate}件
発売日抽出失敗: ${withoutReleaseDate.length}件
リリース情報に変換: ${convertedCount}件
データベース保存済み: ${dbReleasesCount}件

変換率: ${summary.conversionRate}
発売日抽出率: ${summary.releaseDateExtractionRate}

${issues.length > 0 ? "\n【問題点】\n" + issues.join("\n") : ""}
${recommendations.length > 0 ? "\n【改善提案】\n" + recommendations.join("\n") : ""}
      `.trim(),
    });
  } catch (error: any) {
    console.error("Validate releases error:", error);
    res.status(500).json({
      error: error.message || "Failed to validate releases",
      details: error,
    });
  }
}

