/**
 * 🥃 importWhiskyArticles.ts
 * 
 * 目的:
 *  - affiliate-blog/articles/whisky/knowledge/ にある .mdx 記事を読み込み
 *  - Supabase の whisky_articles テーブルに登録する
 * 
 * 前提:
 *  - Supabase に whisky_articles テーブルが存在（SQLで作成済み）
 *  - 環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定済み
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";

// .env.localを読み込む
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Supabaseの環境変数が設定されていません。");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // ① 読み込み元ディレクトリを指定
  const dir = path.join(process.cwd(), "../Affiliate-Project/affiliate-blog/articles/whisky/knowledge");

  if (!fs.existsSync(dir)) {
    console.error(`❌ ディレクトリが存在しません: ${dir}`);
    process.exit(1);
  }

  // ② .mdxファイルを取得
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".mdx"));

  console.log(`📂 読み込み対象ファイル数: ${files.length}`);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, "utf-8");

    // ③ frontmatter解析
    const { data, content } = matter(raw);

    const title =
      data.title ||
      file.replace(".mdx", "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const category = data.category || "知識";
    const tags = data.tags || ["ウイスキー", "RAG"];

    // ④ DB登録
    const { error } = await supabase.from("whisky_articles").insert([
      {
        title,
        content,
        category,
        tags,
      },
    ]);

    if (error) {
      console.error(`❌ 登録失敗: ${file}`, error.message);
    } else {
      console.log(`✅ 登録完了: ${file}`);
    }
  }

  console.log("🎉 全記事の登録が完了しました。");
}

main();
