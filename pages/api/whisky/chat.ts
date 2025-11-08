import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(
  SUPA_URL!,
  SUPA_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    }
    if (!SUPA_URL || !SUPA_KEY) {
      return res.status(500).json({ error: "Supabase credentials missing" });
    }

    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "メッセージが空です" });
    }

    // 🟤 1. ユーザー入力のembedding生成
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message.trim(),
    });
    const embedding = embeddingRes.data[0].embedding;

    // 🟤 2. Supabaseベクトル検索
    const { data: matches, error } = await supabase.rpc(
      "match_whisky_embeddings_v2",
      {
        query_embedding: embedding,
        match_threshold: 0.75,
        match_count: 2,
      }
    );

    if (error) {
      console.error("Supabase RPC error:", error);
      throw error;
    }

    // 🟤 3. レスポンス生成用テキスト
    const recommendationText = matches
      ?.map(
        (m: any, i: number) =>
          `${i + 1}. ${m.brand_name} ${m.expression_name}（${m.type ?? "不明"}）`
      )
      .join("\n") || "おすすめが見つかりませんでした";

    // 🟤 4. GPTで会話風メッセージ生成
    const prompt = `
あなたは上品なバーテンダーです。
以下のユーザーの希望に基づいて、提案結果（ウイスキー）を自然な会話として返してください。

ユーザー入力：
${message}

おすすめ候補：
${recommendationText}

出力形式の例：
「なるほど、今夜は少し静かに過ごしたい気分ですね。
それなら、1杯目に○○、もう少し香りを楽しみたいなら○○はいかがでしょう。
どちらも上品な余韻が楽しめますよ。」
`;

    const reply = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });

    return res.status(200).json({
      bartender: reply.choices[0].message.content,
      recommendations: matches || [],
    });
  } catch (err: any) {
    console.error("Whisky Chat API error:", err);
    return res.status(500).json({
      error: "APIエラー",
      details: err.message,
    });
  }
}

