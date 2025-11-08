/**
 * 🧠 registerWhiskyKnowledgeEmbeddings.ts
 *
 * whisky_articlesテーブルに登録された記事をベクトル化して保存する。
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// .env.localを読み込む
config({ path: resolve(process.cwd(), '.env.local') });

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY が設定されていません');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 環境変数が設定されていません:');
  console.error('   SUPABASE_URL または NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY または NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("🚀 Embedding登録を開始します...");

  // whisky_articles テーブルからまだ embedding がない記事を取得
  const { data: articles, error } = await supabase
    .from("whisky_articles")
    .select("id, title, content")
    .is("embedding", null);

  if (error) {
    console.error("❌ データ取得エラー:", error.message);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log("✨ すべての記事がすでにベクトル化されています。");
    return;
  }

  console.log(`📚 ベクトル化対象: ${articles.length} 件`);

  for (const article of articles) {
    const inputText = `${article.title}\n${article.content}`;

    try {
      // OpenAI Embedding API 呼び出し
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: inputText,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Supabase に保存
      const { error: updateError } = await supabase
        .from("whisky_articles")
        .update({ embedding })
        .eq("id", article.id);

      if (updateError) {
        console.error(`⚠️ 更新失敗: ${article.title}`, updateError.message);
      } else {
        console.log(`✅ ベクトル登録完了: ${article.title}`);
      }

      // 少し間隔をあける（API負荷対策）
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: any) {
      console.error(`❌ Embedding失敗: ${article.title}`, err.message);
    }
  }

  console.log("🎉 すべてのベクトル登録が完了しました。");
}

main();
