import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const results = {
      suntory: { success: false, inserted: 0, error: null },
      nikka: { success: false, inserted: 0, error: null },
      asahi: { success: false, inserted: 0, error: null }
    };

    // サントリーETL実行
    try {
      const suntoryRes = await fetch(`${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/whisky/etl/suntory`);
      const suntoryData = await suntoryRes.json();
      results.suntory = {
        success: suntoryRes.ok,
        inserted: suntoryData.inserted || 0,
        error: suntoryRes.ok ? null : suntoryData.error
      };
    } catch (e: any) {
      results.suntory.error = e.message;
    }

    // ニッカETL実行
    try {
      const nikkaRes = await fetch(`${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/whisky/etl/nikka`);
      const nikkaData = await nikkaRes.json();
      results.nikka = {
        success: nikkaRes.ok,
        inserted: nikkaData.inserted || 0,
        error: nikkaRes.ok ? null : nikkaData.error
      };
    } catch (e: any) {
      results.nikka.error = e.message;
    }

    // アサヒETL実行
    try {
      const asahiRes = await fetch(`${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/whisky/etl/asahi`);
      const asahiData = await asahiRes.json();
      results.asahi = {
        success: asahiRes.ok,
        inserted: asahiData.inserted || 0,
        error: asahiRes.ok ? null : asahiData.error
      };
    } catch (e: any) {
      results.asahi.error = e.message;
    }

    const totalInserted = results.suntory.inserted + results.nikka.inserted + results.asahi.inserted;
    const allSuccess = results.suntory.success && results.nikka.success && results.asahi.success;

    res.status(allSuccess ? 200 : 207).json({
      summary: {
        totalInserted,
        allSuccess,
        timestamp: new Date().toISOString()
      },
      results
    });

  } catch (e: any) {
    console.error("All ETL error:", e);
    res.status(500).json({ error: e?.message || "all etl failed" });
  }
}
