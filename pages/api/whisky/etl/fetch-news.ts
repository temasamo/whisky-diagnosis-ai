import type { NextApiRequest, NextApiResponse } from "next";

/**
 * ニュース取得APIを一括実行する
 * サントリー、ニッカ、アサヒ、キリン、マルス、イチローズモルト、嘉之助、長濱のRSSフィードを取得
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (req.headers.host ? `http://${req.headers.host}` : "http://localhost:3010");

    const results: any[] = [];

    // 1. サントリー
    try {
      const suntoryRes = await fetch(`${baseUrl}/api/whisky/etl/suntory`);
      const suntoryData = await suntoryRes.json();
      results.push({
        source: "suntory",
        status: suntoryRes.ok ? "success" : "error",
        data: suntoryData,
      });
    } catch (err: any) {
      results.push({
        source: "suntory",
        status: "error",
        error: err.message,
      });
    }

    // 2. ニッカ
    try {
      const nikkaRes = await fetch(`${baseUrl}/api/whisky/etl/nikka`);
      const nikkaData = await nikkaRes.json();
      results.push({
        source: "nikka",
        status: nikkaRes.ok ? "success" : "error",
        data: nikkaData,
      });
    } catch (err: any) {
      results.push({
        source: "nikka",
        status: "error",
        error: err.message,
      });
    }

    // 3. アサヒ
    try {
      const asahiRes = await fetch(`${baseUrl}/api/whisky/etl/asahi`);
      const asahiData = await asahiRes.json();
      results.push({
        source: "asahi",
        status: asahiRes.ok ? "success" : "error",
        data: asahiData,
      });
    } catch (err: any) {
      results.push({
        source: "asahi",
        status: "error",
        error: err.message,
      });
    }

    // 4. キリン
    try {
      const kirinRes = await fetch(`${baseUrl}/api/whisky/etl/kirin`);
      const kirinData = await kirinRes.json();
      results.push({
        source: "kirin",
        status: kirinRes.ok ? "success" : "error",
        data: kirinData,
      });
    } catch (err: any) {
      results.push({
        source: "kirin",
        status: "error",
        error: err.message,
      });
    }

    // 5. マルス
    try {
      const marsRes = await fetch(`${baseUrl}/api/whisky/etl/mars`);
      const marsData = await marsRes.json();
      results.push({
        source: "mars",
        status: marsRes.ok ? "success" : "error",
        data: marsData,
      });
    } catch (err: any) {
      results.push({
        source: "mars",
        status: "error",
        error: err.message,
      });
    }

    // 6. イチローズモルト
    try {
      const ichirusRes = await fetch(`${baseUrl}/api/whisky/etl/ichirus`);
      const ichirusData = await ichirusRes.json();
      results.push({
        source: "ichirus",
        status: ichirusRes.ok ? "success" : "error",
        data: ichirusData,
      });
    } catch (err: any) {
      results.push({
        source: "ichirus",
        status: "error",
        error: err.message,
      });
    }

    // 7. 嘉之助
    try {
      const kanosukeRes = await fetch(`${baseUrl}/api/whisky/etl/kanosuke`);
      const kanosukeData = await kanosukeRes.json();
      results.push({
        source: "kanosuke",
        status: kanosukeRes.ok ? "success" : "error",
        data: kanosukeData,
      });
    } catch (err: any) {
      results.push({
        source: "kanosuke",
        status: "error",
        error: err.message,
      });
    }

    // 8. 長濱
    try {
      const nagahamaRes = await fetch(`${baseUrl}/api/whisky/etl/nagahama`);
      const nagahamaData = await nagahamaRes.json();
      results.push({
        source: "nagahama",
        status: nagahamaRes.ok ? "success" : "error",
        data: nagahamaData,
      });
    } catch (err: any) {
      results.push({
        source: "nagahama",
        status: "error",
        error: err.message,
      });
    }

    const totalInserted = results.reduce((sum, r) => {
      if (r.status === "success" && r.data?.inserted) {
        return sum + (r.data.inserted || 0);
      }
      return sum;
    }, 0);

    res.status(200).json({
      results,
      totalInserted,
      message: `ニュース取得を実行しました。合計${totalInserted}件の新しいニュース記事を取得しました。`,
    });
  } catch (error: any) {
    console.error("Fetch news error:", error);
    res.status(500).json({
      error: error.message || "ニュース取得に失敗しました",
      details: error,
    });
  }
}

