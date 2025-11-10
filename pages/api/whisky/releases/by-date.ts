import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
      .order("on_sale_date", { ascending: false, nullsFirst: false })
      .order("announced_date", { ascending: false, nullsFirst: false });

    if (releasesError) {
      return res.status(500).json({
        error: "リリース情報の取得に失敗しました",
        details: releasesError.message,
      });
    }

    // expression_idを取得
    const expressionIds = [...new Set((allReleases || []).map((r: any) => r.expression_id).filter(Boolean))];
    
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

    // キーワード定義（check-status.tsと同じ）
    const whiskyKeywords = [
      'whisky', 'whiskey', 'ウイスキー', 
      '山崎', 'yamazaki', '白州', 'hakushu', '響', 'hibiki',
      'nikka', 'ニッカ', '竹鶴', 'taketsuru', '余市', 'yoichi', '宮城峡', 'miyagikyo',
      'スコッチ', 'scotch', 'バーボン', 'bourbon', 'ハイボール', 'highball',
      'シングルモルト', 'single malt', 'ブレンデッド', 'blended',
      '年', 'year old', 'yo', 'aged', '熟成', 'cask', 'barrel', '樽'
    ];

    const whiskyBrandNames = [
      'suntory', 'サントリー',
      'macallan', 'マッカラン',
      'glenfiddich', 'グレンフィディック',
      'lagavulin', 'ラガヴーリン',
      'glenlivet', 'グレンリベット',
      'ardbeg', 'アードベッグ',
      'laphroaig', 'ラフロイグ',
      'talisker', 'タリスカー',
      'highland park', 'ハイランドパーク',
      'bowmore', 'ボウモア',
      'balvenie', 'バルベニー',
      'dalmore', 'ダルモア',
      'aberlour', 'アベルラー',
      'glenmorangie', 'グレンモレンジー',
      'oban', 'オーバン',
      'springbank', 'スプリングバンク',
      'yamazaki', '山崎',
      'hakushu', '白州',
      'hibiki', '響',
      'taketsuru', '竹鶴',
      'yoichi', '余市',
      'miyagikyo', '宮城峡',
      'nikka', 'ニッカ',
      'jim beam', 'ジムビーム',
      'jack daniel', 'ジャックダニエル',
      'maker\'s mark', 'メーカーズマーク',
      'wild turkey', 'ワイルドターキー',
      'woodford reserve', 'ウッドフォードリザーブ',
      'buffalo trace', 'バッファロートレース',
      'four roses', 'フォーローズ',
      'crown royal', 'クラウンロイヤル',
      'jameson', 'ジェームソン',
      'bushmills', 'ブッシュミルズ',
      'tullamore dew', 'タラモアデュー',
    ];

    const nonWhiskyKeywords = [
      'ビール', 'beer', 'ワイン', 'wine', '焼酎', '日本酒', '清酒',
      'チューハイ', 'ブランデー', 'brandy', 'ラム', 'rum',
      'ウォッカ', 'vodka', 'ジン', 'gin', 'テキーラ', 'tequila',
      'プレミアムモルツ', 'premium malt', '金麦', 'kinmugi',
      '天然水', 'tennensui', '水', 'water',
      // イベント・CSR関連（商品リリースではない）
      'コンサート', 'concert', 'リサイクル', 'recycle', '認定', 'certification',
      '協働', 'collaboration', 'イベント', 'event', 'プログラム', 'program',
      'フィルハーモニー', 'philharmonic', 'ボトルtoボトル', 'bottle to bottle',
      '見学ツアー', 'tour', 'ワイナリー', 'winery', 'ホール', 'hall',
      'クリスマス', 'christmas', 'ニューイヤー', 'new year', '大学', 'university',
      'キャンパス', 'campus', '自然共生', 'nature coexistence', 'サイト', 'site'
    ];

    // ウイスキー関連のリリースをフィルタリング
    const whiskyReleases = (allReleases || []).filter((r: any) => {
      const expr = r.expression_id ? expressionsMap.get(r.expression_id) : null;
      const brand = expr && expr.brand_id ? brandsMap.get(expr.brand_id) : null;
      
      const brandName = (brand?.name || '').toLowerCase();
      const expressionName = (expr?.name || '').toLowerCase();
      const fullText = `${brandName} ${expressionName}`.toLowerCase();
      
      // 優先順位1: ウイスキー以外のキーワードが含まれている場合は除外
      if (nonWhiskyKeywords.some(keyword => fullText.includes(keyword))) {
        return false;
      }
      
      // 優先順位2: ウイスキー関連キーワードが含まれているか
      const hasWhiskyKeyword = whiskyKeywords.some(keyword => fullText.includes(keyword));
      // 優先順位3: ブランド名がウイスキーブランドかどうか
      const isWhiskyBrand = whiskyBrandNames.some(brand => brandName.includes(brand));
      
      return hasWhiskyKeyword || isWhiskyBrand;
    }).map((r: any) => {
      const expr = r.expression_id ? expressionsMap.get(r.expression_id) : null;
      const brand = expr && expr.brand_id ? brandsMap.get(expr.brand_id) : null;
      
      return {
        id: r.id,
        brand: brand?.name || "不明",
        expression: expr?.name || "不明",
        on_sale_date: r.on_sale_date,
        announced_date: r.announced_date,
        created_at: r.created_at,
      };
    });

    // 発売日でグループ化
    const groupedByDate: Record<string, any[]> = {};
    
    whiskyReleases.forEach((release) => {
      // 発売日を優先、なければ発表日を使用
      const dateKey = release.on_sale_date 
        ? release.on_sale_date.slice(0, 10) // YYYY-MM-DD形式
        : release.announced_date 
          ? release.announced_date.slice(0, 10)
          : '日付不明';
      
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(release);
    });

    // 日付順にソート（新しい順）
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
      if (a === '日付不明') return 1;
      if (b === '日付不明') return -1;
      return b.localeCompare(a); // 降順
    });

    const result = sortedDates.map(date => ({
      date,
      count: groupedByDate[date].length,
      releases: groupedByDate[date],
    }));

    res.status(200).json({
      total: whiskyReleases.length,
      groupedByDate: result,
      message: `ウイスキー関連のリリース情報を発売日でグループ化しました（全${whiskyReleases.length}件）`,
    });
  } catch (error: any) {
    console.error("Releases by date error:", error);
    res.status(500).json({
      error: error.message || "Failed to get releases by date",
      details: error,
    });
  }
}

