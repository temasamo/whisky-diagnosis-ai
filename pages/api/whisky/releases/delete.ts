import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "DELETE" && req.method !== "POST") {
      return res.status(405).json({ error: "DELETE or POST method required" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { releaseIds } = req.body;

    if (!releaseIds || !Array.isArray(releaseIds) || releaseIds.length === 0) {
      return res.status(400).json({ error: "releaseIds (array) is required" });
    }

    // リリース情報を削除
    const { data, error } = await supabase
      .from("releases")
      .delete()
      .in("id", releaseIds);

    if (error) {
      console.error("Delete releases error:", error);
      return res.status(500).json({
        error: "リリース情報の削除に失敗しました",
        details: error.message,
      });
    }

    res.status(200).json({
      deleted: releaseIds.length,
      message: `${releaseIds.length}件のリリース情報を削除しました`,
    });
  } catch (error: any) {
    console.error("Delete releases error:", error);
    res.status(500).json({
      error: error.message || "リリース情報の削除に失敗しました",
      details: error,
    });
  }
}

