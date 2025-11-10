import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 全リリース情報を取得（リレーション込み）
    const { data: allReleases, error } = await supabase
      .from("releases")
      .select(`
        id,
        on_sale_date,
        announced_date,
        created_at,
        source_type,
        source_url,
        expression_id,
        expressions:expression_id (
          id,
          name,
          brand_id,
          brands:brand_id (
            id,
            name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        error: "データ取得エラー",
        details: error.message,
      });
    }

    // 各リリースの状態を分析
    const analyzed = (allReleases || []).map((r: any) => {
      const brandName = r.expressions?.brands?.name || null;
      const expressionName = r.expressions?.name || null;
      const hasExpression = !!r.expression_id;
      const hasBrand = !!r.expressions?.brands?.name;
      const hasName = !!(brandName || expressionName);
      
      const fullText = `${brandName || ''} ${expressionName || ''}`.toLowerCase().trim();
      
      return {
        id: r.id,
        created_at: r.created_at,
        on_sale_date: r.on_sale_date,
        announced_date: r.announced_date,
        source_url: r.source_url,
        expression_id: r.expression_id,
        brand_id: r.expressions?.brand_id || null,
        brand_name: brandName,
        expression_name: expressionName,
        has_expression: hasExpression,
        has_brand: hasBrand,
        has_name: hasName,
        full_text: fullText || "(空)",
        is_empty: !fullText,
      };
    });

    // 統計
    const total = analyzed.length;
    const withExpression = analyzed.filter((a) => a.has_expression).length;
    const withBrand = analyzed.filter((a) => a.has_brand).length;
    const withName = analyzed.filter((a) => a.has_name).length;
    const empty = analyzed.filter((a) => a.is_empty).length;

    res.status(200).json({
      summary: {
        total,
        with_expression: withExpression,
        with_brand: withBrand,
        with_name: withName,
        empty,
      },
      releases: analyzed,
      message: `
📊 リリース情報の詳細分析

総数: ${total}件
expression_idあり: ${withExpression}件
brand_idあり: ${withBrand}件
ブランド名・商品名あり: ${withName}件
名前が空: ${empty}件

32件のデータは、Supabaseの \`releases\` テーブルに保存されています。
各リリースは \`expression_id\` を通じて \`expressions\` テーブルと関連付けられ、
さらに \`expressions\` は \`brand_id\` を通じて \`brands\` テーブルと関連付けられています。

判定不明になる原因：
- expression_idがnull
- expressionsが取得できない
- brandsが取得できない
- ブランド名・商品名が空
- ブランド名・商品名にウイスキー関連キーワードもウイスキー以外のキーワードも含まれていない
      `.trim(),
    });
  } catch (error: any) {
    console.error("Debug releases error:", error);
    res.status(500).json({
      error: error.message || "Failed to debug releases",
      details: error,
    });
  }
}

