/**
 * 新しいSupabase (market-ai-suite) へデータをインポート
 * 
 * 使用方法:
 * npm run import:whisky
 * または
 * npx tsx scripts/importWhiskyData.ts
 * 
 * 環境変数:
 * - NEW_SUPABASE_URL: 新しいSupabaseのURL
 * - NEW_SUPABASE_SERVICE_ROLE_KEY: 新しいSupabaseのService Role Key
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// .env.local を読み込む
config({ path: resolve(process.cwd(), '.env.local') });

// 環境変数から新しいSupabaseの接続情報を取得
// 優先順位: NEW_SUPABASE_URL > SUPABASE_URL > NEXT_PUBLIC_SUPABASE_URL
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_SUPABASE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEW_SUPABASE_URL || !NEW_SUPABASE_KEY) {
  console.error('❌ 環境変数が設定されていません:');
  console.error('   NEW_SUPABASE_URL または SUPABASE_URL');
  console.error('   NEW_SUPABASE_SERVICE_ROLE_KEY または SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

interface ExportData {
  brands: any[];
  expressions: any[];
  releases: any[];
  whisky_news: any[];
  exported_at: string;
}

async function importData(): Promise<void> {
  console.log('🚀 データインポートを開始します...\n');

  // エクスポートファイルを読み込み
  const exportPath = path.join(process.cwd(), 'data', 'whisky-data-export.json');
  
  if (!fs.existsSync(exportPath)) {
    console.error(`❌ エクスポートファイルが見つかりません: ${exportPath}`);
    console.error('   先に exportWhiskyData.ts を実行してください。');
    process.exit(1);
  }

  const exportData: ExportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));

  console.log(`📂 エクスポートファイルを読み込みました: ${exportPath}`);
  console.log(`   エクスポート日時: ${exportData.exported_at}\n`);

  const stats = {
    brands: { inserted: 0, skipped: 0 },
    expressions: { inserted: 0, skipped: 0 },
    releases: { inserted: 0, skipped: 0 },
    whisky_news: { inserted: 0, skipped: 0 }
  };

  try {
    // 1. Brands をインポート
    console.log('📦 Brands をインポート中...');
    for (const brand of exportData.brands) {
      // 既存チェック
      const { data: existing } = await newSupabase
        .from('brands')
        .select('id')
        .eq('name', brand.name)
        .maybeSingle();

      if (existing) {
        stats.brands.skipped++;
        continue;
      }

      // 新規挿入
      const { error } = await newSupabase
        .from('brands')
        .insert({ name: brand.name, region: brand.region || null });

      if (error) {
        console.error(`   ⚠️  Brand "${brand.name}" スキップ:`, error.message);
        stats.brands.skipped++;
      } else {
        stats.brands.inserted++;
      }
    }
    console.log(`✅ Brands: ${stats.brands.inserted}件挿入, ${stats.brands.skipped}件スキップ\n`);

    // 2. Expressions をインポート（brand_id を解決）
    console.log('📦 Expressions をインポート中...');
    for (const expr of exportData.expressions) {
      // 旧brand_idに対応する新しいbrandを検索
      const oldBrand = exportData.brands.find(b => b.id === expr.brand_id);
      if (!oldBrand) {
        console.error(`   ⚠️  Expression "${expr.name}" のBrandが見つかりません（スキップ）`);
        stats.expressions.skipped++;
        continue;
      }

      // 新しいbrand_idを取得
      const { data: newBrand } = await newSupabase
        .from('brands')
        .select('id')
        .eq('name', oldBrand.name)
        .single();

      if (!newBrand) {
        console.error(`   ⚠️  Brand "${oldBrand.name}" が見つかりません（スキップ）`);
        stats.expressions.skipped++;
        continue;
      }

      // 既存チェック
      const { data: existingExpr } = await newSupabase
        .from('expressions')
        .select('id')
        .eq('brand_id', newBrand.id)
        .eq('name', expr.name)
        .maybeSingle();

      if (existingExpr) {
        stats.expressions.skipped++;
        continue;
      }

      // 新規挿入
      const { error } = await newSupabase
        .from('expressions')
        .insert({
          brand_id: newBrand.id, 
          name: expr.name 
        });

      if (error) {
        console.error(`   ⚠️  Expression "${expr.name}" スキップ:`, error.message);
        stats.expressions.skipped++;
      } else {
        stats.expressions.inserted++;
      }
    }
    console.log(`✅ Expressions: ${stats.expressions.inserted}件挿入, ${stats.expressions.skipped}件スキップ\n`);

    // 3. Releases をインポート（expression_id を解決）
    console.log('📦 Releases をインポート中...');
    for (const release of exportData.releases) {
      // 旧expression_idに対応する新しいexpressionを検索
      const oldExpr = exportData.expressions.find(e => e.id === release.expression_id);
      if (!oldExpr) {
        stats.releases.skipped++;
        continue;
      }

      const oldBrand = exportData.brands.find(b => b.id === oldExpr.brand_id);
      if (!oldBrand) {
        stats.releases.skipped++;
        continue;
      }

      // 新しいexpression_idを取得
      const { data: newExpr } = await newSupabase
        .from('expressions')
        .select('id')
        .eq('name', oldExpr.name)
        .single();

      if (!newExpr) {
        stats.releases.skipped++;
        continue;
      }

      // Release データを準備（全てのカラムを含める）
      const releaseData: any = {
        expression_id: newExpr.id,
      };
      
      // 全てのカラムを追加（marketはスキップ）
      if (release.announced_date !== undefined) releaseData.announced_date = release.announced_date;
      if (release.on_sale_date !== undefined) releaseData.on_sale_date = release.on_sale_date;
      if (release.source_type !== undefined) releaseData.source_type = release.source_type;
      if (release.source_url !== undefined) releaseData.source_url = release.source_url;
      // if (release.market !== undefined) releaseData.market = release.market; // marketカラムが存在しない場合はコメントアウト
      if (release.source_org !== undefined) releaseData.source_org = release.source_org;
      if (release.retailer !== undefined) releaseData.retailer = release.retailer;
      if (release.price_minor !== undefined) releaseData.price_minor = release.price_minor;
      if (release.currency !== undefined) releaseData.currency = release.currency;
      if (release.stock_status !== undefined) releaseData.stock_status = release.stock_status;
      if (release.source_priority !== undefined) releaseData.source_priority = release.source_priority;

      // 重複チェック（source_org + source_url）
      if (release.source_org && release.source_url) {
        const { data: existing } = await newSupabase
          .from('releases')
          .select('id')
          .eq('source_org', release.source_org)
          .eq('source_url', release.source_url)
          .maybeSingle();

        if (existing) {
          stats.releases.skipped++;
          continue;
        }
      }

      // 存在しないカラムを自動的に除外して再試行（最大10回）
      let attempts = 0;
      let lastError: any = null;
      
      while (attempts < 10) {
        const { error } = await newSupabase
          .from('releases')
          .insert(releaseData);

        if (!error) {
          stats.releases.inserted++;
          break;
        }

        lastError = error;
        
        // カラムが存在しないエラーの場合、そのカラムを除外して再試行
        if (error.message.includes("Could not find the '") && error.message.includes("' column")) {
          const columnMatch = error.message.match(/Could not find the '([^']+)' column/);
          if (columnMatch) {
            const missingColumn = columnMatch[1];
            delete releaseData[missingColumn];
            attempts++;
            continue;
          }
        }
        
        // その他のエラーはスキップ
        console.error(`   ⚠️  Release スキップ:`, error.message);
        stats.releases.skipped++;
        break;
      }
      
      if (attempts >= 10 && lastError) {
        console.error(`   ⚠️  Release スキップ（再試行回数超過）:`, lastError.message);
        stats.releases.skipped++;
      }
    }
    console.log(`✅ Releases: ${stats.releases.inserted}件挿入, ${stats.releases.skipped}件スキップ\n`);

    // 4. Whisky News をインポート（オプション）
    if (exportData.whisky_news.length > 0) {
      console.log('📦 Whisky News をインポート中...');
      for (const news of exportData.whisky_news) {
        const { error } = await newSupabase
          .from('whisky_news')
          .upsert(news, { onConflict: 'source_url' });

        if (error) {
          // テーブルが存在しない場合はスキップ
          if (error.code === 'PGRST116') {
            console.log('   ℹ️  whisky_news テーブルが存在しないためスキップします');
            break;
          }
          stats.whisky_news.skipped++;
        } else {
          stats.whisky_news.inserted++;
        }
      }
      console.log(`✅ Whisky News: ${stats.whisky_news.inserted}件挿入, ${stats.whisky_news.skipped}件スキップ\n`);
    }

    // 結果サマリー
    console.log('📊 インポート結果:');
    console.log(`   Brands: ${stats.brands.inserted}件挿入, ${stats.brands.skipped}件スキップ`);
    console.log(`   Expressions: ${stats.expressions.inserted}件挿入, ${stats.expressions.skipped}件スキップ`);
    console.log(`   Releases: ${stats.releases.inserted}件挿入, ${stats.releases.skipped}件スキップ`);
    console.log(`   Whisky News: ${stats.whisky_news.inserted}件挿入, ${stats.whisky_news.skipped}件スキップ`);

  } catch (error: any) {
    console.error('❌ インポートエラー:', error);
    process.exit(1);
  }
}

// 実行
importData()
  .then(() => {
    console.log('\n✅ インポート完了！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
