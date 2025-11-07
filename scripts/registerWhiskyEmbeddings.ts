/**
 * Whisky Embedding 登録スクリプト
 * Supabase + OpenAI embeddings
 * 実行コマンド: pnpm tsx scripts/registerWhiskyEmbeddings.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// .env.local を読み込む
config({ path: resolve(process.cwd(), '.env.local') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY が設定されていません');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 環境変数が設定されていません:');
  console.error('   SUPABASE_URL または NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY または NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const whiskyData = [
  {
    brand_name: "Suntory",
    expression_name: "山崎 12年",
    type: "シングルモルト",
    region: "大阪府 山崎",
    country: "日本",
    flavor_notes: "蜂蜜、バニラ、樽香の調和",
    description: "日本を代表する滑らかで上品なシングルモルト",
  },
  {
    brand_name: "Suntory",
    expression_name: "白州 12年",
    type: "シングルモルト",
    region: "山梨県 南アルプス",
    country: "日本",
    flavor_notes: "青リンゴや若葉の爽やかさ",
    description: "森林を思わせる軽快な香りとキレの良い味わい",
  },
  {
    brand_name: "Suntory",
    expression_name: "響 JAPANESE HARMONY",
    type: "ブレンデッド",
    region: "山崎・白州ブレンド",
    country: "日本",
    flavor_notes: "蜂蜜、花、ミルクチョコ",
    description: "日本のブレンデッド技術が光る滑らかで調和の取れた味わい",
  },
  {
    brand_name: "Suntory",
    expression_name: "知多",
    type: "グレーン",
    region: "愛知県 知多",
    country: "日本",
    flavor_notes: "穏やかな甘みとほのかなスパイス",
    description: "軽やかでクリーン、ハイボールにも最適なグレーンウイスキー",
  },
  {
    brand_name: "Nikka",
    expression_name: "余市 10年",
    type: "シングルモルト",
    region: "北海道 余市",
    country: "日本",
    flavor_notes: "スモーキーで力強いピート香",
    description: "海風とピートが生む重厚な味わいでファンに愛される一本",
  },
  {
    brand_name: "Nikka",
    expression_name: "宮城峡 NV",
    type: "シングルモルト",
    region: "宮城県 仙台",
    country: "日本",
    flavor_notes: "シナモンと果実の柔らかな香り",
    description: "華やかで繊細、余市と対を成す軽快なシングルモルト",
  },
  {
    brand_name: "Nikka",
    expression_name: "竹鶴 ピュアモルト",
    type: "ピュアモルト",
    region: "北海道・宮城",
    country: "日本",
    flavor_notes: "麦芽の香ばしさと軽いスモーク",
    description: "日本のウイスキー創始者の名を冠したバランスの良いモルト",
  },
  {
    brand_name: "Glenfiddich",
    expression_name: "グレンフィディック 12年",
    type: "シングルモルト",
    region: "スペイサイド",
    country: "スコットランド",
    flavor_notes: "洋梨や青リンゴのフルーティさ",
    description: "世界的に人気の高い爽やかなスタンダードモルト",
  },
  {
    brand_name: "Glenlivet",
    expression_name: "グレンリベット 12年",
    type: "シングルモルト",
    region: "スペイサイド",
    country: "スコットランド",
    flavor_notes: "シトラスと蜂蜜のクリーンな甘み",
    description: "軽やかで飲みやすいスペイサイドの入門モルト",
  },
  {
    brand_name: "Macallan",
    expression_name: "マッカラン 12年 シェリーオーク",
    type: "シングルモルト",
    region: "スペイサイド",
    country: "スコットランド",
    flavor_notes: "ドライフルーツとバニラ、リッチなシェリー香",
    description: "濃厚な甘みとコクで知られるプレミアムモルト",
  },
  {
    brand_name: "Laphroaig",
    expression_name: "ラフロイグ 10年",
    type: "シングルモルト",
    region: "アイラ",
    country: "スコットランド",
    flavor_notes: "ヨード、スモーク、海藻",
    description: "医療的とも称される独特なピート香でアイラを代表する一本",
  },
  {
    brand_name: "Ardbeg",
    expression_name: "アードベッグ 10年",
    type: "シングルモルト",
    region: "アイラ",
    country: "スコットランド",
    flavor_notes: "強烈なスモークとダークチョコ",
    description: "ピートの爆発力と甘みのバランスがとれたヘビーピートモルト",
  },
  {
    brand_name: "Lagavulin",
    expression_name: "ラガヴーリン 16年",
    type: "シングルモルト",
    region: "アイラ",
    country: "スコットランド",
    flavor_notes: "重厚なピートとシェリーの深み",
    description: "海風を感じる厚みのある味わいで長い余韻が特徴",
  },
  {
    brand_name: "Talisker",
    expression_name: "タリスカー 10年",
    type: "シングルモルト",
    region: "スカイ島",
    country: "スコットランド",
    flavor_notes: "潮風と黒胡椒のスパイス",
    description: "海と火山が育む力強いスモーキーアイランズモルト",
  }
];

(async () => {
  console.log("🟡 Whisky Embedding Registration Started");

  for (const whisky of whiskyData) {
    try {
      const text = `${whisky.brand_name} ${whisky.expression_name} ${whisky.type} ${whisky.region} ${whisky.country} ${whisky.flavor_notes} ${whisky.description}`;

      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });

      const embedding = embeddingResponse.data[0].embedding;

      const { error } = await supabase.from("whisky_embeddings_v2").insert([
        {
          ...whisky,
          embedding,
        },
      ]);

      if (error) {
        console.error("❌ Insert error:", whisky.expression_name, error);
      } else {
        console.log(`✅ ${whisky.brand_name} ${whisky.expression_name} 登録完了`);
      }
    } catch (err) {
      console.error(`❌ 処理エラー: ${whisky.expression_name}`, err);
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log("🎉 All whisky embeddings registered successfully!");
})();
