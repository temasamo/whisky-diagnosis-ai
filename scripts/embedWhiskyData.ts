/**
 * ウイスキーデータをベクトル化してSupabaseに登録
 * 
 * 使用方法:
 * npm run embed:whisky
 * または
 * npx tsx scripts/embedWhiskyData.ts
 * 
 * 環境変数:
 * - SUPABASE_URL: SupabaseのURL
 * - SUPABASE_SERVICE_ROLE_KEY: SupabaseのService Role Key
 * - OPENAI_API_KEY: OpenAI API Key（ベクトル化に使用）
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// .env.local を読み込む
config({ path: resolve(process.cwd(), '.env.local') });

// 環境変数
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 環境変数が設定されていません:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('⚠️  OPENAI_API_KEY が設定されていません。ベクトル化はスキップされます。');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

interface WhiskyEmbedding {
  id: string;
  brand: string;
  expression: string;
  description: string;
  embedding: number[];
}

async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error('OpenAI API Key が設定されていません');
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

async function embedWhiskyData(): Promise<void> {
  console.log('🚀 ベクトル化を開始します...\n');

  if (!openai) {
    console.error('❌ OpenAI API Key が必要です');
    process.exit(1);
  }

  const stats = {
    processed: 0,
    embedded: 0,
    skipped: 0,
    errors: 0
  };

  try {
    // 1. Expressions を取得
    console.log('📦 ウイスキーデータを取得中...');
    const { data: expressions, error: exprError } = await supabase
      .from('expressions')
      .select('id, name, brand_id');
    
    if (exprError) {
      console.error('❌ Expressions 取得エラー:', exprError);
      process.exit(1);
    }

    // 2. Brands を取得
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, name, region');
    
    if (brandsError) {
      console.error('❌ Brands 取得エラー:', brandsError);
      process.exit(1);
    }

    // 3. Expressions と Brands を結合
    const expressionsWithBrands = (expressions || []).map(expr => {
      const brand = (brands || []).find(b => b.id === expr.brand_id);
      return {
        ...expr,
        brands: brand || { id: null, name: 'Unknown', region: null }
      };
    });

    console.log(`✅ ${expressionsWithBrands.length}件のExpressionを取得しました\n`);

    // 4. 各Expressionに対してベクトルを生成
    for (const expr of expressionsWithBrands) {
      try {
        stats.processed++;

        const brand = expr.brands as any;
        const brandName = brand?.name || 'Unknown';
        const expressionName = expr.name || 'Unknown';

        // ベクトル化用のテキストを生成
        const text = `${brandName} ${expressionName} ウイスキー`;
        
        console.log(`   [${stats.processed}/${expressionsWithBrands.length}] ${brandName} ${expressionName} を処理中...`);

        // ベクトルを生成
        const embedding = await generateEmbedding(text);

        // Supabase のベクトルテーブルに保存
        // 注意: このテーブル構造はプロジェクトに応じて調整が必要です
        const { error: embedError } = await supabase
          .from('whisky_embeddings')
          .upsert({
            expression_id: expr.id,
            brand_name: brandName,
            expression_name: expressionName,
            text: text,
            embedding: embedding,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'expression_id'
          });

        if (embedError) {
          // テーブルが存在しない場合はスキップ
          if (embedError.code === 'PGRST116' || embedError.code === 'PGRST205') {
            console.log(`\n⚠️  whisky_embeddings テーブルが存在しません。`);
            console.log(`   以下のSQLでテーブルを作成してください:\n`);
            console.log(`   CREATE TABLE whisky_embeddings (`);
            console.log(`     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),`);
            console.log(`     expression_id UUID REFERENCES expressions(id),`);
            console.log(`     brand_name TEXT,`);
            console.log(`     expression_name TEXT,`);
            console.log(`     text TEXT,`);
            console.log(`     embedding vector(1536),`);
            console.log(`     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),`);
            console.log(`     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),`);
            console.log(`     UNIQUE(expression_id)`);
            console.log(`   );`);
            console.log(`\n   -- pgvector拡張を有効にする場合:`);
            console.log(`   CREATE EXTENSION IF NOT EXISTS vector;`);
            process.exit(1);
          }
          console.error(`   ❌ エラー:`, embedError.message);
          stats.errors++;
        } else {
          stats.embedded++;
          console.log(`   ✅ ベクトル化完了`);
        }

        // API レート制限を避けるため、少し待機
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`   ❌ 処理エラー:`, error.message);
        stats.errors++;
      }
    }

    // 結果サマリー
    console.log('\n📊 ベクトル化結果:');
    console.log(`   処理済み: ${stats.processed}件`);
    console.log(`   ベクトル化成功: ${stats.embedded}件`);
    console.log(`   スキップ: ${stats.skipped}件`);
    console.log(`   エラー: ${stats.errors}件`);

  } catch (error: any) {
    console.error('❌ ベクトル化エラー:', error);
    process.exit(1);
  }
}

// 実行
embedWhiskyData()
  .then(() => {
    console.log('\n✅ ベクトル化完了！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
