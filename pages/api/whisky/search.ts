import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabaseクライアント初期化
 */
const supabase = createClient(
  SUPA_URL!,
  SUPA_KEY!
);

/**
 * POSTメソッド：ウイスキー類似検索API
 * - クライアントから送信されたベクトル（query_embedding）を使って
 *   SupabaseのRPC関数 match_whisky_embeddings_v2 を呼び出す
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!SUPA_URL) {
      return res.status(500).json({ error: "SUPABASE_URL missing" });
    }
    if (!SUPA_KEY) {
      return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY missing" });
    }

    const { query_embedding } = req.body;

    if (!query_embedding || !Array.isArray(query_embedding)) {
      return res.status(400).json({ error: "query_embedding is required and must be an array" });
    }

    // SupabaseのRPC（Remote Procedure Call）を実行（パラメータを統一）
    const { data, error } = await supabase.rpc("match_whisky_embeddings_v2", {
      query_embedding,
      match_threshold: 0.75,
      match_count: 5,
    });

    if (error) {
      console.error("Whisky search error:", error);
      throw error;
    }

    // 新仕様のカラム名にマッピング
    const mappedResults = (data || []).map((item: any) => ({
      id: item.id,
      brand_name: item.brand_name,
      expression_name: item.expression_name,
      type: item.type,
      region: item.region,
      country: item.country,
      flavor_notes: item.flavor_notes,
      description: item.description,
      similarity: item.similarity,
    }));

    // 検索結果をJSON形式で返す
    return res.status(200).json({ results: mappedResults });
  } catch (err: any) {
    console.error("❌ Search error:", err);
    return res.status(500).json({
      error: "検索中にエラーが発生しました",
      details: err.message,
    });
  }
}

