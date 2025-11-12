/**
 * convertFlavorNotesToJSON.ts
 * 
 * 既存の flavor_notes カラムを AI で解析し、
 * aroma / palate / finish に分類して flavor_json(jsonb) カラムに保存する。
 */

import { config } from "dotenv";
import { resolve } from "path";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// .env.localを読み込む
config({ path: resolve(process.cwd(), ".env.local") });

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY が設定されていません");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Supabase認証情報が設定されていません");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("🧠 Converting flavor_notes → flavor_json ...");

  // Step 1. flavor_notes を取得
  const { data: rows, error } = await supabase
    .from("whisky_embeddings_v2")
    .select("id, brand_name, expression_name, flavor_notes")
    .is("flavor_json", null); // 未変換のものだけ対象

  if (error) throw error;
  if (!rows?.length) {
    console.log("✅ すべてのレコードがすでに変換済みです。");
    return;
  }

  for (const row of rows) {
    console.log(`🟢 Processing: ${row.brand_name} ${row.expression_name || ""}`);

    const prompt = `
あなたはウイスキーのテイスティングノート専門家です。
以下のテキストを "aroma"（香り）、"palate"（味わい）、"finish"（余韻）に分類し、
日本語でJSON形式で出力してください。

出力形式の例：
{
  "aroma": ["バニラ", "青リンゴ"],
  "palate": ["チョコ", "オーク", "スモーク"],
  "finish": ["長い余韻", "スパイシー"]
}

入力テキスト：
${row.flavor_notes || "（記載なし）"}
`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "あなたはウイスキーのテイスティングノート専門家です。テキストを aroma（香り）、palate（味わい）、finish（余韻）に分類し、JSON形式で出力してください。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      });

      const jsonText = completion.choices[0].message?.content;
      if (!jsonText) {
        throw new Error("AIからの応答が空です");
      }

      const flavorJSON = JSON.parse(jsonText);

      const { error: updateError } = await supabase
        .from("whisky_embeddings_v2")
        .update({ flavor_json: flavorJSON })
        .eq("id", row.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`✅ Saved JSON for: ${row.brand_name} ${row.expression_name || ""}`);
      // APIレート制限回避のため少し待機
      await new Promise((r) => setTimeout(r, 1500));

    } catch (err: any) {
      console.error(`❌ Error at ${row.brand_name} ${row.expression_name || ""}:`, err.message);
    }
  }

  console.log("🎉 全レコードの変換が完了しました。");
}

main();
