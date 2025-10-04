import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const MOM_URL = "https://www.masterofmalt.com/new-arrivals/whisky/";

const supa = () =>
  createClient(
    process.env.SUPABASE_URL!,              // ← サーバ専用
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // ← サーバ専用
  );

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // 環境変数チェック
  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: "SUPABASE_URL missing" });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" });
  }
  
  try {
    // まずはモックデータでテスト
    const mockItems = [
      {
        name: "Macallan 18 Year Old",
        price_minor: 15000,
        currency: "GBP",
        source_url: "https://www.masterofmalt.com/whiskies/macallan-18-year-old/"
      },
      {
        name: "Glenfiddich 21 Year Old",
        price_minor: 12000,
        currency: "GBP", 
        source_url: "https://www.masterofmalt.com/whiskies/glenfiddich-21-year-old/"
      },
      {
        name: "Lagavulin 16 Year Old",
        price_minor: 8000,
        currency: "GBP",
        source_url: "https://www.masterofmalt.com/whiskies/lagavulin-16-year-old/"
      }
    ];

    const client = supa();
    let inserted = 0;

    for (const it of mockItems) {
      // ブランド名と表現名を分離
      const parts = it.name.split(" ");
      const brandName = parts[0]; // Macallan, Glenfiddich, Lagavulin
      const exprName = parts.slice(1).join(" "); // 18 Year Old, 21 Year Old, 16 Year Old

      // brands upsert
      const { data: brand, error: bErr } = await client
        .from("brands")
        .upsert({ name: brandName }, { onConflict: "name" })
        .select("id")
        .single();
      if (bErr) throw bErr;

      // expressions upsert
      const { data: expr, error: eErr } = await client
        .from("expressions")
        .upsert({ brand_id: brand!.id, name: exprName }, { onConflict: "brand_id,name" })
        .select("id")
        .single();
      if (eErr) throw eErr;

      // releases upsert（今日の入荷として）
      const today = new Date().toISOString().slice(0, 10);
      const { error: rErr } = await client.from("releases").upsert(
        {
          expression_id: expr!.id,
          on_sale_date: today,
          market: "UK",
          source_type: "retailer",
          retailer: "Master of Malt",
          source_url: it.source_url,
          price_minor: it.price_minor,
          currency: it.currency,
          stock_status: "in_stock",
        },
        { onConflict: "expression_id,market,on_sale_date,retailer" }
      );
      if (rErr) throw rErr;
      inserted++;
    }

    res.status(200).json({ 
      inserted, 
      sample: mockItems,
      message: "ETL completed successfully with mock data"
    });
  } catch (e: any) {
    console.error("ETL Error:", e);
    res.status(500).json({ 
      error: e.message ?? String(e),
      message: "ETL failed"
    });
  }
}