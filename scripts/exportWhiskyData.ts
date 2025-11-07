/**
 * 旧Supabase (whisky_diagnosis_ai) からデータをエクスポート
 * 
 * 使用方法:
 * npm run export:whisky
 * または
 * npx tsx scripts/exportWhiskyData.ts
 * 
 * 環境変数:
 * - OLD_SUPABASE_URL: 旧SupabaseのURL
 * - OLD_SUPABASE_SERVICE_ROLE_KEY: 旧SupabaseのService Role Key
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// .env.local を読み込む
config({ path: resolve(process.cwd(), '.env.local') });

// 環境変数から旧Supabaseの接続情報を取得
// 優先順位: OLD_SUPABASE_URL > SUPABASE_URL > NEXT_PUBLIC_SUPABASE_URL
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const OLD_SUPABASE_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_SUPABASE_URL || !OLD_SUPABASE_KEY) {
  console.error('❌ 環境変数が設定されていません:');
  console.error('   OLD_SUPABASE_URL または SUPABASE_URL');
  console.error('   OLD_SUPABASE_SERVICE_ROLE_KEY または SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

interface ExportData {
  brands: any[];
  expressions: any[];
  releases: any[];
  whisky_news: any[];
  whisky_knowledge: any[];
  rag_history: any[];
  exported_at: string;
}

async function exportData(): Promise<void> {
  console.log('🚀 データエクスポートを開始します...\n');

  const exportData: ExportData = {
    brands: [],
    expressions: [],
    releases: [],
    whisky_news: [],
    whisky_knowledge: [],
    rag_history: [],
    exported_at: new Date().toISOString()
  };

  try {
    // 1. Brands をエクスポート
    console.log('📦 Brands をエクスポート中...');
    const { data: brands, error: brandsError } = await oldSupabase
      .from('brands')
      .select('*')
      .order('id');

    if (brandsError) {
      console.error('❌ Brands エクスポートエラー:', brandsError);
    } else {
      exportData.brands = brands || [];
      console.log(`✅ Brands: ${exportData.brands.length}件`);
    }

    // 2. Expressions をエクスポート
    console.log('📦 Expressions をエクスポート中...');
    const { data: expressions, error: expressionsError } = await oldSupabase
      .from('expressions')
      .select('*')
      .order('id');

    if (expressionsError) {
      console.error('❌ Expressions エクスポートエラー:', expressionsError);
    } else {
      exportData.expressions = expressions || [];
      console.log(`✅ Expressions: ${exportData.expressions.length}件`);
    }

    // 3. Releases をエクスポート
    console.log('📦 Releases をエクスポート中...');
    const { data: releases, error: releasesError } = await oldSupabase
      .from('releases')
      .select('*')
      .order('created_at', { ascending: false });

    if (releasesError) {
      console.error('❌ Releases エクスポートエラー:', releasesError);
    } else {
      exportData.releases = releases || [];
      console.log(`✅ Releases: ${exportData.releases.length}件`);
    }

    // 4. Whisky News をエクスポート
    console.log('📦 Whisky News をエクスポート中...');
    const { data: whiskyNews, error: newsError } = await oldSupabase
      .from('whisky_news')
      .select('*')
      .order('published_at', { ascending: false });

    if (newsError) {
      console.error('⚠️  Whisky News テーブルが見つかりません（スキップ）:', newsError.message);
      exportData.whisky_news = [];
    } else {
      exportData.whisky_news = whiskyNews || [];
      console.log(`✅ Whisky News: ${exportData.whisky_news.length}件`);
    }

    // 5. Whisky Knowledge をエクスポート（M氏のコメント）
    console.log('📦 Whisky Knowledge をエクスポート中...');
    const { data: whiskyKnowledge, error: knowledgeError } = await oldSupabase
      .from('whisky_knowledge')
      .select('*')
      .order('created_at', { ascending: false });

    if (knowledgeError) {
      console.error('⚠️  Whisky Knowledge テーブルが見つかりません（スキップ）:', knowledgeError.message);
      exportData.whisky_knowledge = [];
    } else {
      exportData.whisky_knowledge = whiskyKnowledge || [];
      console.log(`✅ Whisky Knowledge: ${exportData.whisky_knowledge.length}件`);
    }

    // 6. RAG History をエクスポート
    console.log('📦 RAG History をエクスポート中...');
    const { data: ragHistory, error: historyError } = await oldSupabase
      .from('rag_history')
      .select('*')
      .order('timestamp', { ascending: false });

    if (historyError) {
      console.error('⚠️  RAG History テーブルが見つかりません（スキップ）:', historyError.message);
      exportData.rag_history = [];
    } else {
      exportData.rag_history = ragHistory || [];
      console.log(`✅ RAG History: ${exportData.rag_history.length}件`);
    }

    // 5. JSONファイルに保存
    const outputDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'whisky-data-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

    console.log('\n📊 エクスポート結果:');
    console.log(`   Brands: ${exportData.brands.length}件`);
    console.log(`   Expressions: ${exportData.expressions.length}件`);
    console.log(`   Releases: ${exportData.releases.length}件`);
    console.log(`   Whisky News: ${exportData.whisky_news.length}件`);
    console.log(`   Whisky Knowledge (M氏のコメント): ${exportData.whisky_knowledge.length}件`);
    console.log(`   RAG History: ${exportData.rag_history.length}件`);
    console.log(`\n💾 データを保存しました: ${outputPath}`);

  } catch (error: any) {
    console.error('❌ エクスポートエラー:', error);
    process.exit(1);
  }
}

// 実行
exportData()
  .then(() => {
    console.log('\n✅ エクスポート完了！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
