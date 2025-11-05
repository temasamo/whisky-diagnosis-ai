/**
 * whisky_knowledge テーブルに初期データをインポート
 * lib/rag-database.ts の初期データをSupabaseに移行
 * 
 * 使用方法:
 * npm run import:whisky-knowledge
 * または
 * npx tsx scripts/importWhiskyKnowledge.ts
 * 
 * 環境変数:
 * - SUPABASE_URL または NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { ragDatabase, initializeRAGDatabase } from '../lib/rag-database';

// .env.local を読み込む
config({ path: resolve(process.cwd(), '.env.local') });

// 環境変数からSupabaseの接続情報を取得
// 優先順位: SUPABASE_URL > NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 環境変数が設定されていません:');
  console.error('   SUPABASE_URL または NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importWhiskyKnowledge() {
  console.log('🚀 whisky_knowledge データ移行を開始します...\n');

  try {
    // RAGデータベースを初期化（初期データを読み込む）
    console.log('📦 初期データを読み込み中...');
    initializeRAGDatabase();
    
    // 全知識を取得
    const allKnowledge = ragDatabase.getAllKnowledge();
    console.log(`✅ ${allKnowledge.length}件の知識を取得しました\n`);

    if (allKnowledge.length === 0) {
      console.log('⚠️  インポートするデータがありません');
      return;
    }

    // Supabaseのスキーマに合わせてデータを変換
    const formattedData = allKnowledge.map((item) => {
      const data: any = {
        brand: item.brand || null,
        name: item.name || null,
        description: item.description || null,
        characteristics: item.characteristics || null,
        availability: item.availability || null,
        price_range: item.priceRange || null, // priceRange → price_range
        tags: item.tags || [],
        source: item.source || null,
        created_at: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        updated_at: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
      };
      
      // オプショナルフィールド（テーブルに存在する場合のみ）
      // category, confidence はテーブルに存在しない可能性があるため、エラー時に対応
      
      return data;
    });

    console.log(`📝 ${formattedData.length}件のデータをSupabaseにインポート中...\n`);

    // 重複チェック（既存データを確認）
    const { data: existing } = await supabase
      .from('whisky_knowledge')
      .select('id, brand, name');

    const existingSet = new Set(
      (existing || []).map(e => `${e.brand}|${e.name}`)
    );

    const newData = formattedData.filter(
      item => !existingSet.has(`${item.brand}|${item.name}`)
    );

    if (existing && existing.length > 0) {
      console.log(`⚠️  既存データ: ${existing.length}件`);
    }

    if (newData.length === 0) {
      console.log('✅ すべてのデータが既に存在しています');
      return;
    }

    console.log(`📤 新規データ: ${newData.length}件を追加します\n`);

    // バッチサイズで分割して挿入（Supabaseの制限を考慮）
    const batchSize = 10;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < newData.length; i += batchSize) {
      const batch = newData.slice(i, i + batchSize);
      
      // 存在しないカラムを自動的に除外して再試行
      let attempts = 0;
      let lastError: any = null;
      let batchData = [...batch];
      
      while (attempts < 10) {
        const { data, error } = await supabase
          .from('whisky_knowledge')
          .insert(batchData)
          .select();

        if (!error) {
          inserted += data?.length || 0;
          console.log(`   ✅ バッチ ${Math.floor(i / batchSize) + 1}: ${data?.length || 0}件を追加`);
          break;
        }

        lastError = error;

        // 存在しないカラムエラーの場合、そのカラムを除外して再試行
        if (error.message.includes("Could not find the '") && error.message.includes("' column")) {
          const columnMatch = error.message.match(/Could not find the '([^']+)' column/);
          if (columnMatch) {
            const missingColumn = columnMatch[1];
            console.log(`   ⚠️  カラム '${missingColumn}' が見つかりません。除外して再試行...`);
            batchData = batchData.map(item => {
              const { [missingColumn]: _, ...rest } = item;
              return rest;
            });
            attempts++;
            continue;
          }
        }
        
        // その他のエラーの場合
        console.error(`❌ バッチ ${Math.floor(i / batchSize) + 1} のエラー:`, error.message);
        skipped += batch.length;
        break;
      }
      
      if (lastError && attempts >= 10) {
        console.error(`❌ バッチ ${Math.floor(i / batchSize) + 1} のエラー:`, lastError.message);
        skipped += batch.length;
      }
    }

    console.log('\n📊 インポート結果:');
    console.log(`   ✅ 追加: ${inserted}件`);
    if (skipped > 0) {
      console.log(`   ⚠️  スキップ: ${skipped}件`);
    }
    console.log(`\n💾 完了！`);

  } catch (error: any) {
    console.error('❌ インポートエラー:', error);
    process.exit(1);
  }
}

// 実行
importWhiskyKnowledge()
  .then(() => {
    console.log('\n✅ インポート完了！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });

