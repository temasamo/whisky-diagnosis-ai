// pages/api/whisky/etl/rss.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { runCombinedSuntoryFeeds } from "../../../../lib/rss-etl";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const result = await runCombinedSuntoryFeeds();
    res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}
