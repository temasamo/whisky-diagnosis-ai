/**
 * /api/whisky/rag/search.ts
 * 
 * 🧠 RAG検索API
 * - ユーザーの質問をEmbedding化
 * - Supabaseで類似ベクトルを検索
 * - 記事内容をAI回答に統合して返す
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

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
    return res.status(405).json({ error: "POSTメソッドのみ対応しています。" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    }
    if (!SUPA_URL || !SUPA_KEY) {
      return res.status(500).json({ error: "Supabase credentials missing" });
    }

    const { query } = req.body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({ error: "質問内容（query）が必要です。" });
    }

    // Step1️⃣: 質問をembedding化
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query.trim(),
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Step2️⃣: Supabaseで類似検索
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_whisky_articles",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5, // 閾値を下げてより多くの結果を取得
        match_count: 3,
      }
    );

    if (matchError) {
      console.error("Supabase RPC error:", matchError);
      throw matchError;
    }

    if (!matches || matches.length === 0) {
      return res.status(200).json({
        answer: "関連する記事が見つかりませんでした。",
        sources: [],
      });
    }

    // Step3️⃣: 類似記事の本文を連結
    const contextText = matches
      .map((m: any) => `【${m.title}】\n${m.content}`)
      .join("\n\n---\n\n");

    // Step4️⃣: ChatGPTに質問＋関連情報を渡して要約回答を生成
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたはウイスキーの専門家ソムリエです。質問に対して、丁寧かつわかりやすく日本語で回答してください。文中に専門用語が出た場合は、初心者にもわかるように補足してください。",
        },
        {
          role: "user",
          content: `質問: ${query}\n\n参考情報:\n${contextText}`,
        },
      ],
      max_tokens: 500,
    });

    const answer = completion.choices[0].message?.content ?? "回答を生成できませんでした。";

    return res.status(200).json({
      answer,
      sources: matches.map((m: any) => ({
        title: m.title,
        id: m.id,
        similarity: m.similarity,
      })),
    });
  } catch (err: any) {
    console.error("❌ RAG検索エラー:", err);
    return res.status(500).json({
      error: "RAG検索中にエラーが発生しました",
      details: err.message,
    });
  }
}

