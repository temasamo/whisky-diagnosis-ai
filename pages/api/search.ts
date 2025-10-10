import type { NextApiRequest, NextApiResponse } from "next";
import type { RawProduct, GroupedResult, SearchResponse } from "@/types/search";
import { canonicalKey, parseVolume, parseAbv } from "@/lib/normalize";
import { winsorize } from "@/lib/price";
import { badStore } from "@/lib/stores";

// 環境変数を直接読み込み
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID || "1034629000425828286";
const YAHOO_APP_ID = process.env.YAHOO_APP_ID || "dj00aiZpPUdDbHlSZEk2WG90dCZzPWNvbnN1bWVyc2VjcmV0Jng9NWM-";
const NO_FILTER = process.env.NO_FILTER === "1";

const clean = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();

// 内容量情報を抽出
function extractVolumeInfo(q: string): { preferredVolume?: number; volumeRange?: { min: number; max: number } } {
  const volumeMatch = q.match(/(\d+)ml/);
  if (volumeMatch) {
    const volume = parseInt(volumeMatch[1], 10);
    return { preferredVolume: volume };
  }
  
  // 複数の内容量が指定されている場合の範囲を検出
  const volumes = q.match(/(\d+)ml/g);
  if (volumes && volumes.length > 1) {
    const volumeNumbers = volumes.map(v => parseInt(v.replace('ml', ''), 10));
    const min = Math.min(...volumeNumbers);
    const max = Math.max(...volumeNumbers);
    return { volumeRange: { min, max } };
  }
  
  return {};
}

// 検索語を最適化（診断結果に基づいた検索クエリを生成）
function optimizeQuery(q: string): string {
  let optimized = q.toLowerCase();
  
  // 地域名を英語に変換（検索精度向上）
  optimized = optimized.replace(/スペイサイド/g, 'speyside');
  optimized = optimized.replace(/アイラ/g, 'islay');
  optimized = optimized.replace(/ハイランド/g, 'highland');
  optimized = optimized.replace(/ローランド/g, 'lowland');
  optimized = optimized.replace(/キャンベルタウン/g, 'campbeltown');
  optimized = optimized.replace(/ジャパニーズ/g, 'japanese');
  
  // ピート関連のキーワードを保持
  optimized = optimized.replace(/ピート控えめ/g, 'light peat');
  optimized = optimized.replace(/ピート/g, 'peat');
  optimized = optimized.replace(/ノンピート/g, 'no peat');
  optimized = optimized.replace(/スモーキー/g, 'smoky');
  
  // 味わいのキーワードを保持
  optimized = optimized.replace(/フルーティ/g, 'fruity');
  optimized = optimized.replace(/バランス/g, 'balanced');
  
  // 用途と価格帯を削除（検索を広げるため）
  optimized = optimized.replace(/自分で飲む/g, '');
  optimized = optimized.replace(/ギフト/g, '');
  optimized = optimized.replace(/プレゼント/g, '');
  optimized = optimized.replace(/〜\d+円/g, '');
  optimized = optimized.replace(/\d+ml/g, '');
  optimized = optimized.replace(/（標準）/g, '');
  optimized = optimized.replace(/（フルーティ）/g, '');
  optimized = optimized.replace(/（スモーキー）/g, '');
  optimized = optimized.replace(/（バランス）/g, '');
  optimized = optimized.replace(/（fruity）/g, '');
  optimized = optimized.replace(/（smoky）/g, '');
  optimized = optimized.replace(/について詳しく聞きたい/g, '');
  optimized = optimized.replace(/詳しく聞きたい/g, '');
  optimized = optimized.replace(/ほどよく/g, '');
  optimized = optimized.replace(/peat/g, '');
  optimized = optimized.replace(/fruity/g, '');
  optimized = optimized.replace(/smoky/g, '');
  
  // 余分な空白を整理
  optimized = optimized.replace(/\s+/g, ' ').trim();
  
  // ウイスキーキーワードを追加（より厳密に）
  if (!optimized.includes('whisky') && !optimized.includes('ウイスキー') && 
      !optimized.includes('whiskey') && !optimized.includes('スコッチ') && 
      !optimized.includes('scotch') && !optimized.includes('バーボン') && 
      !optimized.includes('bourbon')) {
    optimized = `whisky ${optimized}`;
  }
  
  // ウイスキー以外の酒類を除外するキーワードを追加
  optimized = `${optimized} -日本酒 -清酒 -焼酎 -ビール -ワイン -梅酒 -スパークリング -ブランデー -コニャック -ラム -ウォッカ -ジン -テキーラ -cd -dvd -レコード -アルバム -音楽 -映画 -アニメ -ゲーム -本 -書籍 -雑誌 -チラシ -ポスター -グッズ -フィギュア -おもちゃ -アクセサリー -服 -衣類`;
  
  // サントリーの場合は具体的な商品名を追加
  if (optimized.includes('サントリー') || optimized.includes('suntory')) {
    optimized = `${optimized} 山崎 白州 響 知多 角ウイスキー`;
  }
  
  // 空になった場合は基本的な検索語にフォールバック
  if (!optimized || optimized.length < 3) {
    return 'whisky';
  }
  
  // 検索クエリが複雑すぎる場合は、主要なキーワードのみに絞る
  const keywords = optimized.split(' ').filter(word => 
    word.length > 2 && 
    !word.includes('（') && 
    !word.includes('）') &&
    !word.includes('〜') &&
    !word.includes('円') &&
    !word.includes('なし') &&
    !word.includes('控えめ') &&
    !word.includes('詳しく') &&
    !word.includes('聞きたい') &&
    !word.includes('について')
  );
  
  // 最大2つのキーワードに絞る（シンプルに）
  if (keywords.length > 2) {
    return keywords.slice(0, 2).join(' ');
  }
  
  return optimized;
}

async function searchRakuten(q: string): Promise<RawProduct[]> {
  const optimizedQ = optimizeQuery(q);
  console.log(`Rakuten search: ${optimizedQ}`);
  
  // 楽天APIのパラメータを修正（hits=30以下に制限）
  const params = new URLSearchParams();
  params.set("format", "json");
  params.set("applicationId", RAKUTEN_APP_ID);
  params.set("keyword", optimizedQ);
  params.set("hits", "30");
  params.set("imageFlag", "1");
  params.set("sort", "+itemPrice");
  
  const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params.toString()}`;
  console.log(`Rakuten URL: ${url}`);
  
  const r = await fetch(url); 
  if (!r.ok) {
    console.error(`Rakuten API error: ${r.status} ${r.statusText}`);
    const errorText = await r.text();
    console.error(`Rakuten error response: ${errorText}`);
    throw new Error(`rakuten ${r.status}`);
  }
  
  const data = await r.json();
  console.log(`Rakuten response: ${JSON.stringify(data).substring(0, 200)}...`);
  
  const items = data.Items?.map((w: Record<string, unknown>)=>w.Item) || [];
  console.log(`Rakuten items found: ${items.length}`);
  
  return items.map((it: Record<string, unknown>)=>({
    mall:"rakuten" as const, id:String(it.itemCode || it.itemUrl), title: clean(it.itemName as string),
    price: Number(it.itemPrice ?? null), url: it.itemUrl as string,
    image: (it.mediumImageUrls as { imageUrl: string }[])?.[0]?.imageUrl || (it.smallImageUrls as { imageUrl: string }[])?.[0]?.imageUrl || null,
    shop: it.shopName as string || null,
    volume_ml: parseVolume(it.itemName as string), abv: parseAbv(it.itemName as string)
  }));
}

async function searchYahoo(q: string): Promise<RawProduct[]> {
  const optimizedQ = optimizeQuery(q);
  console.log(`Yahoo search: ${optimizedQ}`);
  
  const u = new URL("https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch");
  u.searchParams.set("appid", YAHOO_APP_ID); 
  u.searchParams.set("query", optimizedQ);
  u.searchParams.set("results","50");
  u.searchParams.set("sort","+price");
  
  console.log(`Yahoo URL: ${u.toString()}`);
  
  const r = await fetch(u.toString()); 
  if (!r.ok) {
    console.error(`Yahoo API error: ${r.status} ${r.statusText}`);
    throw new Error(`yahoo ${r.status}`);
  }
  
  const data = await r.json();
  console.log(`Yahoo response: ${JSON.stringify(data).substring(0, 200)}...`);
  
  const items = data.hits || [];
  console.log(`Yahoo items found: ${items.length}`);
  
  return items.map((it: Record<string, unknown>)=>({
    mall:"yahoo" as const, id:String(it.code || it.url), title: clean(it.name as string),
    price: Number(it.price ?? (it.priceLabel as { defaultPrice: number })?.defaultPrice ?? null), url: it.url as string,
    image: (it.image as { medium?: string; small?: string })?.medium || (it.image as { medium?: string; small?: string })?.small || null, 
    shop: (it.seller as { name: string })?.name || null,
    volume_ml: parseVolume(it.name as string), abv: parseAbv(it.name as string)
  }));
}

function whiskyFilter(p: RawProduct): boolean {
  if (NO_FILTER) return true;
  const t = p.title.toLowerCase();
  
  // 除外する商品カテゴリを拡張
  const excludePatterns = [
    /(日本酒|清酒|焼酎|ビール|ワイン|梅酒|スパークリング|ブランデー|コニャック|ラム|ウォッカ|ジン|テキーラ)/,
    /(cd|dvd|ブルーレイ|レコード|アルバム|シングル|音楽|映画|アニメ|ゲーム|本|書籍|雑誌)/,
    /(チラシ|ポスター|グッズ|フィギュア|おもちゃ|アクセサリー|服|衣類)/,
    /(映画|ドラマ|アニメ|漫画|小説|文庫|新書)/,
    /(限定|特典|初回|通常|アウトレット|訳あり|中古|古本)/,
    /(送料|配送|梱包|箱|ケース|ボトル|グラス|タンブラー)/,
    /(サンプル|試供品|ミニ|小瓶|小容量|少量)/,
    /(福袋|セット|詰め合わせ|ギフト|プレゼント)/,
    /(チケット|券|パス|入場|観覧|体験)/,
    /(食品|お菓子|スナック|チョコ|キャンディ|ガム)/,
    /(化粧品|香水|オーデコロン|シャンプー|石鹸)/,
    /(家具|インテリア|照明|カーペット|カーテン)/,
    /(家電|電子機器|スマホ|タブレット|パソコン)/,
    /(スポーツ|フィットネス|ジム|ヨガ|ランニング)/,
    /(車|バイク|自転車|アクセサリー|パーツ)/,
    /(ペット|犬|猫|魚|鳥|小動物)/,
    /(園芸|植物|花|種|苗|肥料)/,
    /(工具|DIY|工作|修理|メンテナンス)/,
    /(旅行|宿泊|ホテル|旅館|温泉)/,
    /(保険|金融|投資|証券|ローン)/,
    /(教育|学習|教材|参考書|問題集)/,
    /(医療|健康|薬|サプリ|マスク)/,
    /(美容|エステ|マッサージ|リラクゼーション)/,
    /(レジャー|アウトドア|キャンプ|釣り|登山)/,
    /(コレクション|収集|コイン|切手|カード)/,
    /(アート|絵画|彫刻|工芸|手芸)/,
    /(ベビー|キッズ|子供|赤ちゃん|育児)/,
    /(シニア|高齢者|介護|福祉|医療)/,
    /(ビジネス|オフィス|文具|事務用品)/,
    /(イベント|パーティー|結婚式|葬儀)/,
    /(その他|そのた|その他|そのた|その他)/,
  ];
  
  // 除外パターンにマッチする場合は除外
  for (const pattern of excludePatterns) {
    if (pattern.test(t)) {
      return false;
    }
  }
  
  // ウイスキー関連キーワードが含まれているかチェック
  const whiskyKeywords = [
    /ウイスキー/i,
    /whisky/i,
    /whiskey/i,
    /スコッチ/i,
    /scotch/i,
    /バーボン/i,
    /bourbon/i,
    /ライ/i,
    /rye/i,
    /アイリッシュ/i,
    /irish/i,
    /カナディアン/i,
    /canadian/i,
    /ジャパニーズ/i,
    /japanese/i,
    /シングルモルト/i,
    /single malt/i,
    /ブレンデッド/i,
    /blended/i,
    /グレーン/i,
    /grain/i,
    /モルト/i,
    /malt/i,
    /蒸留/i,
    /distill/i,
    /樽/i,
    /barrel/i,
    /cask/i,
    /熟成/i,
    /aged/i,
    /年/i,
    /yo/i,
    /度/i,
    /proof/i,
    /アルコール/i,
    /alcohol/i,
    /酒/i,
    /spirit/i,
    /リキュール/i,
    /liqueur/i,
  ];
  
  // ウイスキー関連キーワードが含まれているかチェック
  const hasWhiskyKeyword = whiskyKeywords.some(pattern => pattern.test(t));
  if (!hasWhiskyKeyword) {
    return false;
  }
  
  // 除外する店舗
  if (badStore(p.shop || "")) return false;
  
  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse | { error: string }>
) {
  try {
    const q = clean(String(req.query.q || ""));
    const budget = Number(req.query.budget || 0);
    if (!q) return res.status(400).json({ error: "q is required" });

    console.log(`Original query: ${q}`);
    
    // 診断結果に基づいた検索クエリを生成
    const searchQuery = optimizeQuery(q);
    console.log(`Optimized query: ${searchQuery}`);

    // Yahoo API障害対応: 楽天APIのみで動作
    let rk: RawProduct[] = [];
    let yh: RawProduct[] = [];
    
    try {
      rk = await searchRakuten(searchQuery);
      console.log(`Rakuten results: ${rk.length}`);
    } catch (error) {
      console.error('Rakuten API error:', error);
    }
    
    try {
      yh = await searchYahoo(searchQuery);
      console.log(`Yahoo results: ${yh.length}`);
    } catch (error) {
      console.error('Yahoo API error (可能な障害):', error);
      // Yahoo API障害時は楽天のみで継続
    }
    
    let merged = [...rk, ...yh].filter(whiskyFilter);
    console.log(`After filtering: ${merged.length}`);

    // 内容量フィルタリングを適用
    const volumeInfo = extractVolumeInfo(q);
    if (volumeInfo.preferredVolume || volumeInfo.volumeRange) {
      const originalLength = merged.length;
      merged = merged.filter(item => {
        if (!item.volume_ml) return false; // 内容量が不明な場合は除外
        
        if (volumeInfo.preferredVolume) {
          // 指定された内容量に近いものを優先（±30mlの範囲内、より厳密に）
          const diff = Math.abs(item.volume_ml - volumeInfo.preferredVolume);
          return diff <= 30;
        }
        
        if (volumeInfo.volumeRange) {
          // 指定された範囲内の内容量
          return item.volume_ml >= volumeInfo.volumeRange.min && 
                 item.volume_ml <= volumeInfo.volumeRange.max;
        }
        
        return true;
      });
      console.log(`Volume filtering: ${originalLength} -> ${merged.length} items`);
      
      // 内容量フィルタリング後も結果が少ない場合は、より広い範囲で再検索
      if (merged.length < 5 && volumeInfo.preferredVolume) {
        console.log("Too few results after strict volume filtering, trying broader range...");
        const broaderMerged = [...rk, ...yh].filter(whiskyFilter).filter(item => {
          if (!item.volume_ml) return false;
          const diff = Math.abs(item.volume_ml - volumeInfo.preferredVolume);
          return diff <= 100; // より広い範囲（±100ml）
        });
        
        if (broaderMerged.length > merged.length) {
          merged = broaderMerged;
          console.log(`Broader volume filtering: ${broaderMerged.length} items`);
        }
      }
    }

    // 結果が0件の場合は、よりシンプルな検索を試す
    if (merged.length === 0) {
      console.log("No results found, trying fallback search...");
      
      // フォールバック検索（よりシンプルなクエリ）
      const fallbackQuery = q.includes('サントリー') || q.includes('suntory') ? 'whisky サントリー' :
                           q.includes('ニッカ') || q.includes('nikka') ? 'whisky ニッカ' :
                           q.includes('ジャパニーズ') || q.includes('japanese') ? 'whisky 日本' :
                           q.includes('スペイサイド') || q.includes('speyside') ? 'whisky スペイサイド' :
                           'whisky';
      
      console.log(`Fallback search: ${fallbackQuery}`);
      
      try {
        const fallbackRk = await searchRakuten(fallbackQuery);
        const fallbackYh = await searchYahoo(fallbackQuery);
        const fallbackMerged = [...fallbackRk, ...fallbackYh].filter(whiskyFilter);
        console.log(`Fallback results: ${fallbackMerged.length}`);
        
        if (fallbackMerged.length > 0) {
          merged = fallbackMerged;
        }
      } catch (error) {
        console.error("Fallback search failed:", error);
      }
    }

    const prices = merged.map(x=>x.price).filter((n): n is number => typeof n === "number");
    const { pmin, pmax } = winsorize(prices, 0.05, 0.95);

    // 予算フィルタリング
    let budgetFiltered = merged;
    if (budget > 0) {
      console.log(`Budget filtering: ${budget} yen`);
      budgetFiltered = merged.filter(item => {
        if (!item.price) return true; // 価格情報がない場合は含める
        return item.price <= budget;
      });
      console.log(`Budget filtering: ${merged.length} -> ${budgetFiltered.length} items`);
      
      // 予算内の商品が少ない場合は、予算の1.5倍まで許容
      if (budgetFiltered.length < 5) {
        const extendedBudget = budget * 1.5;
        budgetFiltered = merged.filter(item => {
          if (!item.price) return true;
          return item.price <= extendedBudget;
        });
        console.log(`Extended budget filtering (${extendedBudget}): ${budgetFiltered.length} items`);
      }
    }

    const byKey: Record<string, RawProduct[]> = {};
    for (const p of budgetFiltered) {
      const key = canonicalKey(p.title);
      (byKey[key] ||= []).push(p);
    }

    const groups: GroupedResult[] = Object.entries(byKey)
      .map(([key, arr]) => {
        if (arr.length === 0) return null;
        
        const eligible = arr
          .filter(a => a.price != null)
          .filter(a => (pmin == null || a.price! >= pmin) && (pmax == null || a.price! <= pmax));
        const sorted = (eligible.length ? eligible : arr).sort((a,b)=>(a.price ?? 9e12) - (b.price ?? 9e12));
        const cheapest = sorted[0] || arr[0];
        
        if (!cheapest) return null;
        
        return { key, cheapest, offers: arr };
      })
      .filter((item): item is GroupedResult => item !== null);

    const ranked = groups
      .sort((a,b) => {
        const ap = a.cheapest.price ?? 9e12, bp = b.cheapest.price ?? 9e12;
        
        // 内容量が指定されている場合は、内容量の近さを最優先
        if (volumeInfo.preferredVolume) {
          const aVolume = a.cheapest.volume_ml ?? 0;
          const bVolume = b.cheapest.volume_ml ?? 0;
          
          if (aVolume && bVolume) {
            const aDiff = Math.abs(aVolume - volumeInfo.preferredVolume);
            const bDiff = Math.abs(bVolume - volumeInfo.preferredVolume);
            if (aDiff !== bDiff) return aDiff - bDiff;
          }
        }
        
        if (budget) {
          const da = Math.abs(ap - budget), db = Math.abs(bp - budget);
          if (da !== db) return da - db;
        }
        return ap - bp;
      });

    console.log(`Final results: ${ranked.length}`);
    res.status(200).json({ 
      query: q, 
      items: ranked.slice(0, 18),
      volumeInfo: extractVolumeInfo(q)
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "search_error";
    console.error('Search error:', error);
    res.status(500).json({ error });
  }
}
