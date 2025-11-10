import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * 発売情報取得の現在の状態を簡単に確認するAPI
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. ニュース記事数を確認
    const { count: newsCount, error: newsError } = await supabase
      .from("whisky_news")
      .select("*", { count: "exact", head: true });

    // リリース情報の作成日範囲を取得（総数の期間確認用）
    const { data: allReleases } = await supabase
      .from("releases")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    // リリース情報の作成日範囲
    const releaseCreatedDates = (allReleases || []).map((r: any) => 
      r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : null
    ).filter(Boolean) as string[];
    
    const releaseDateRange = releaseCreatedDates.length > 0 ? {
      start: releaseCreatedDates.sort()[0],
      end: releaseCreatedDates.sort().reverse()[0],
    } : null;

    // リリース情報の作成日範囲内のニュース記事数を確認
    let newsInReleasePeriod = 0;
    if (releaseDateRange) {
      const { count: newsInPeriod } = await supabase
        .from("whisky_news")
        .select("*", { count: "exact", head: true })
        .gte("created_at", releaseDateRange.start + "T00:00:00")
        .lte("created_at", releaseDateRange.end + "T23:59:59");
      newsInReleasePeriod = newsInPeriod || 0;
    }

    // 2. リリース情報数を確認（総数の期間も取得）
    const { count: releaseCount, error: releaseError } = await supabase
      .from("releases")
      .select("*", { count: "exact", head: true });

    // 総数の期間を取得（最初と最後のcreated_at）
    const { data: firstRelease } = await supabase
      .from("releases")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const { data: lastRelease } = await supabase
      .from("releases")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 発売日の範囲も取得（on_sale_dateまたはannounced_date）
    const { data: releasesWithDates } = await supabase
      .from("releases")
      .select("on_sale_date, announced_date")
      .or("on_sale_date.not.is.null,announced_date.not.is.null")
      .limit(1000);

    const allDates: string[] = [];
    releasesWithDates?.forEach((r: any) => {
      if (r.on_sale_date) allDates.push(r.on_sale_date.slice(0, 10));
      if (r.announced_date) allDates.push(r.announced_date.slice(0, 10));
    });
    
    const uniqueDates = [...new Set(allDates)].sort();
    const saleDateRange = uniqueDates.length > 0 ? {
      start: uniqueDates[0],
      end: uniqueDates[uniqueDates.length - 1],
      isSingleDay: uniqueDates.length === 1,
    } : null;

    // 3. 直近7日間のデータを確認
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    
    // 日付カラムを確認（pub_date, published_at, created_atのいずれか）
    const { data: sampleNews } = await supabase
      .from("whisky_news")
      .select("*")
      .limit(1)
      .single();
    
    const dateColumn = sampleNews?.pub_date ? 'pub_date' :
                      sampleNews?.published_at ? 'published_at' :
                      sampleNews?.created_at ? 'created_at' : 'created_at';

    const { count: recentNewsCount } = await supabase
      .from("whisky_news")
      .select("*", { count: "exact", head: true })
      .gte(dateColumn, since.toISOString());

    // リリース情報の全件を取得（ウイスキー判定用）
    const { data: allReleasesForCheck, error: releasesError } = await supabase
      .from("releases")
      .select(`
        id,
        on_sale_date,
        announced_date,
        created_at,
        source_type,
        expression_id
      `)
      .order("created_at", { ascending: false });

    if (releasesError) {
      console.error("Releases fetch error:", releasesError);
    }

    // expression_idを取得
    const expressionIds = [...new Set((allReleasesForCheck || []).map((r: any) => r.expression_id).filter(Boolean))];
    
    console.log(`[DEBUG] Total releases: ${(allReleasesForCheck || []).length}`);
    console.log(`[DEBUG] Releases with expression_id: ${expressionIds.length}`);
    console.log(`[DEBUG] Sample expression_ids:`, expressionIds.slice(0, 5));
    
    // expressionsを取得
    let expressions: any[] = [];
    if (expressionIds.length > 0) {
      const { data: exprs, error: exprsError } = await supabase
        .from("expressions")
        .select("id, name, brand_id")
        .in("id", expressionIds);
      
      if (exprsError) {
        console.error("[DEBUG] Expressions fetch error:", exprsError);
      } else {
        expressions = exprs || [];
        console.log(`[DEBUG] Fetched expressions: ${expressions.length}`);
        console.log(`[DEBUG] Sample expressions:`, expressions.slice(0, 3).map((e: any) => ({ id: e.id, name: e.name })));
      }
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

    // メモリ内で結合（他のAPIと同じ方法）
    const expressionsMap = new Map((expressions || []).map((e: any) => [e.id, e]));
    const brandsMap = new Map((brands || []).map((b: any) => [b.id, b]));

    // リリース情報にexpressionsとbrandsを結合
    const allReleasesWithRelations = (allReleasesForCheck || []).map((r: any) => {
      const expr = r.expression_id ? expressionsMap.get(r.expression_id) : null;
      const brand = expr && expr.brand_id ? brandsMap.get(expr.brand_id) : null;
      
      // デバッグ: 最初の5件だけログ出力
      if ((allReleasesForCheck || []).indexOf(r) < 5) {
        console.log(`[DEBUG] Release ${r.id}:`, {
          expression_id: r.expression_id,
          found_expression: !!expr,
          expression_name: expr?.name || "null",
          found_brand: !!brand,
          brand_name: brand?.name || "null"
        });
      }
      
      return {
        ...r,
        expressions: expr ? {
          ...expr,
          brands: brand
        } : null
      };
    });

    // キーワード定義（共通）
    const whiskyKeywords = [
      'whisky', 'whiskey', 'ウイスキー', 
      '山崎', 'yamazaki', '白州', 'hakushu', '響', 'hibiki',
      'nikka', 'ニッカ', '竹鶴', 'taketsuru', '余市', 'yoichi', '宮城峡', 'miyagikyo',
      'スコッチ', 'scotch', 'バーボン', 'bourbon', 'ハイボール', 'highball',
      'シングルモルト', 'single malt', 'ブレンデッド', 'blended',
      '年', 'year old', 'yo', 'aged', '熟成', 'cask', 'barrel', '樽'
    ];

    // 有名なウイスキーブランド名（商品名にキーワードがなくてもブランド名で判定）
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

    // リリース情報の統計（全件）
    const releasesWithWhisky = (allReleasesWithRelations || []).filter((r: any) => {
      const brandName = (r.expressions?.brands?.name || '').toLowerCase();
      const expressionName = (r.expressions?.name || '').toLowerCase();
      const fullText = `${brandName} ${expressionName}`.toLowerCase();
      
      // 優先順位1: ウイスキー以外のキーワードが含まれている場合は除外（最優先）
      if (nonWhiskyKeywords.some(keyword => fullText.includes(keyword))) {
        return false;
      }
      
      // 優先順位2: ウイスキー関連キーワードが含まれているか（商品名・ブランド名）
      const hasWhiskyKeyword = whiskyKeywords.some(keyword => fullText.includes(keyword));
      
      // 優先順位3: ブランド名がウイスキーブランドかどうか（ただし、商品名にウイスキー以外のキーワードがない場合のみ）
      const isWhiskyBrand = whiskyBrandNames.some(brand => brandName.includes(brand));
      
      // 商品名にウイスキー関連キーワードがある、またはブランド名がウイスキーブランドの場合
      return hasWhiskyKeyword || isWhiskyBrand;
    });

    // 各リリースを分類
    const releasesWithoutWhisky: any[] = [];
    const releasesUncertain: any[] = [];

    (allReleasesWithRelations || []).forEach((r: any) => {
      const brandName = (r.expressions?.brands?.name || '').toLowerCase();
      const expressionName = (r.expressions?.name || '').toLowerCase();
      const fullText = `${brandName} ${expressionName}`.toLowerCase();
      
      // 優先順位1: ウイスキー以外のキーワードが含まれている場合は除外（最優先）
      const hasNonWhiskyKeyword = nonWhiskyKeywords.some(keyword => fullText.includes(keyword));
      if (hasNonWhiskyKeyword) {
        releasesWithoutWhisky.push(r);
        return;
      }
      
      // 優先順位2: ウイスキー関連キーワードが含まれているかチェック（商品名・ブランド名）
      const hasWhiskyKeyword = whiskyKeywords.some(keyword => fullText.includes(keyword));
      
      // 優先順位3: ブランド名がウイスキーブランドかどうか
      const isWhiskyBrand = whiskyBrandNames.some(brand => brandName.includes(brand));
      
      // ウイスキー関連に含まれている場合はスキップ（releasesWithWhiskyに含まれる）
      if (hasWhiskyKeyword || isWhiskyBrand) {
        return; // releasesWithWhiskyに含まれるのでスキップ
      }
      
      // どちらのキーワードも含まれていない場合（判定不明）
      releasesUncertain.push(r);
    });

    // 直近7日間のリリース情報
    const { data: recentReleases, count: recentReleaseCount } = await supabase
      .from("releases")
      .select(`
        id,
        on_sale_date,
        announced_date,
        created_at,
        source_type,
        expression_id
      `, { count: "exact" })
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(10); // サンプル10件

    const status = {
      period: {
        start: sinceStr,
        end: todayStr,
        days: 7,
      },
      news: {
        total: newsCount || 0,
        recent7days: recentNewsCount || 0,
        hasData: (newsCount || 0) > 0,
        description: "RSSフィードから取得したニュース記事（生データ）",
        inReleasePeriod: newsInReleasePeriod,
        releasePeriod: releaseDateRange,
      },
      releases: {
        total: releaseCount || 0,
        recent7days: recentReleaseCount || 0,
        hasData: (releaseCount || 0) > 0,
        whiskyCount: releasesWithWhisky.length,
        nonWhiskyCount: releasesWithoutWhisky.length,
        uncertainCount: releasesUncertain.length,
        description: "ニュース記事から抽出した商品リリース情報（構造化データ）",
        totalPeriod: {
          start: firstRelease?.created_at ? new Date(firstRelease.created_at).toISOString().slice(0, 10) : null,
          end: lastRelease?.created_at ? new Date(lastRelease.created_at).toISOString().slice(0, 10) : null,
          isSingleDay: firstRelease?.created_at && lastRelease?.created_at 
            ? new Date(firstRelease.created_at).toISOString().slice(0, 10) === new Date(lastRelease.created_at).toISOString().slice(0, 10)
            : false,
        },
        saleDateRange: saleDateRange,
        samples: (recentReleases || []).slice(0, 5).map((r: any) => {
          // recentReleasesにもexpressionsとbrandsを結合
          const expr = r.expression_id ? expressionsMap.get(r.expression_id) : null;
          const brand = expr && expr.brand_id ? brandsMap.get(expr.brand_id) : null;
          return {
            brand: brand?.name || "不明",
            expression: expr?.name || "不明",
            on_sale_date: r.on_sale_date,
            announced_date: r.announced_date,
            isWhisky: releasesWithWhisky.some((w: any) => w.id === r.id),
          };
        }),
        nonWhiskySamples: releasesWithoutWhisky.slice(0, 10).map((r: any) => ({
          brand: r.expressions?.brands?.name || "不明",
          expression: r.expressions?.name || "不明",
          on_sale_date: r.on_sale_date,
          announced_date: r.announced_date,
        })) || [],
        uncertainSamples: releasesUncertain.slice(0, 10).map((r: any) => ({
          brand: r.expressions?.brands?.name || "不明",
          expression: r.expressions?.name || "不明",
          on_sale_date: r.on_sale_date,
          announced_date: r.announced_date,
        })) || [],
      },
      nextSteps: [] as string[],
    };

    // 矛盾チェック: リリース情報があるのにニュース記事がない場合
    const hasInconsistency = status.releases.total > 0 && status.news.total === 0;
    const hasPeriodInconsistency = status.releases.total > 0 && 
      status.releases.totalPeriod && 
      status.news.inReleasePeriod === 0;
    
    // ウイスキー以外の商品が含まれている場合
    const hasNonWhiskyReleases = status.releases.nonWhiskyCount > 0;

    // 次のステップを提案
    if (hasNonWhiskyReleases) {
      status.nextSteps.push(`⚠️ 問題: リリース情報にウイスキー以外の商品が${status.releases.nonWhiskyCount}件含まれています`);
      status.nextSteps.push("   → フィルタリングロジックが正しく動作していない可能性があります");
      status.nextSteps.push("   → または、手動で追加されたデータの可能性があります");
    } else if (hasInconsistency) {
      status.nextSteps.push("⚠️ 矛盾: リリース情報があるのにニュース記事がありません");
      status.nextSteps.push("   → ニュース記事が削除された可能性があります");
      status.nextSteps.push("   → または、リリース情報が手動で追加された可能性があります");
    } else if (hasPeriodInconsistency) {
      status.nextSteps.push("⚠️ 矛盾: リリース情報の作成期間内にニュース記事がありません");
      status.nextSteps.push(`   → リリース情報の期間: ${status.releases.totalPeriod?.start} ～ ${status.releases.totalPeriod?.end}`);
      status.nextSteps.push(`   → その期間のニュース記事: ${status.news.inReleasePeriod}件`);
    } else if (!status.news.hasData) {
      status.nextSteps.push("1. RSSフィード取得APIを実行: /api/whisky/etl/suntory");
      status.nextSteps.push("2. または: /api/whisky/etl/nikka, /api/whisky/etl/asahi");
    } else if (!status.releases.hasData) {
      status.nextSteps.push("1. ニュースをリリース情報に変換: /api/whisky/etl/news-to-releases");
    } else if (status.releases.recent7days === 0) {
      status.nextSteps.push("1. 直近のニュースをリリース情報に変換: /api/whisky/etl/news-to-releases");
    }

    res.status(200).json({
      status,
      message: `
📊 発売情報取得の現在の状態

【期間】${status.period.start} ～ ${status.period.end}（直近7日間）

📰 ニュース記事: ${status.news.total}件（直近7日: ${status.news.recent7days}件）
   → RSSフィードから取得した生のニュース記事

📦 リリース情報: ${status.releases.total}件（直近7日: ${status.releases.recent7days}件）
   → ニュース記事から抽出した商品リリース情報
   → ウイスキー関連: ${status.releases.whiskyCount}件

【違い】
・ニュース記事: RSSフィードから取得した生データ（タイトル、リンクなど）
・リリース情報: ニュースから抽出した構造化データ（ブランド、商品名、発売日など）

${status.nextSteps.length > 0 ? "\n【次のステップ】\n" + status.nextSteps.join("\n") : "✅ すべて正常に動作しています"}
      `.trim(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || "Failed to check status",
      details: error,
    });
  }
}

