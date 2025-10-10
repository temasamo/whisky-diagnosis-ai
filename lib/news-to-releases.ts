// ニュースから商品リリース情報を自動抽出する機能

export interface NewsItem {
  id: string;
  source: string;
  brand_hint: string | null;
  title: string;
  link: string;
  pub_date: string | null;
  image_url: string | null;
}

export interface ReleaseItem {
  brand: string;
  expression: string;
  announced_date: string | null;
  on_sale_date?: string | null;
  source_type: "press";
  source_url: string;
  market: string;
  retailer?: string;
  source_org?: string;
}

// 商品リリース関連のキーワード
const RELEASE_KEYWORDS = [
  /新発売/i,
  /新商品/i,
  /期間限定/i,
  /限定/i,
  /発売/i,
  /リリース/i,
  /発表/i,
  /登場/i,
  /販売開始/i,
  /予約開始/i,
  /受付開始/i,
  /缶/i,
  /ボトル/i,
  /ウイスキー/i,
  /whisky/i,
  /whiskey/i,
];

// 除外キーワード（商品リリースではないニュース）
const EXCLUDE_KEYWORDS = [
  /投資/i,
  /出資/i,
  /助成/i,
  /募集/i,
  /採用/i,
  /イベント/i,
  /展示会/i,
  /セミナー/i,
  /講演/i,
  /受賞/i,
  /表彰/i,
  /文化財団/i,
  /研究/i,
  /学術/i,
  /教育/i,
  /CSR/i,
  /社会貢献/i,
  /環境/i,
  /持続可能性/i,
  /サステナビリティ/i,
];

// ウイスキー以外の商品カテゴリ（除外対象）
const NON_WHISKY_KEYWORDS = [
  // ハイボールはウイスキーベースなので除外しない
  // チューハイは焼酎ベースなので除外する
  /チューハイ/i,
  /chu-hai/i,
  // 196シリーズはRTD飲料なので除外
  /-196/i,
  /１９６/i,
  /196/i,
  /イチキューロク/i,
  /ビール/i,
  /beer/i,
  /ワイン/i,
  /wine/i,
  /梅酒/i,
  /スパークリング/i,
  /ブランデー/i,
  /brandy/i,
  /コニャック/i,
  /cognac/i,
  /ラム/i,
  /rum/i,
  /ウォッカ/i,
  /vodka/i,
  /ジン/i,
  /gin/i,
  /テキーラ/i,
  /tequila/i,
  /焼酎/i,
  /日本酒/i,
  /清酒/i,
  /カクテル/i,
  /cocktail/i,
  /ソフトドリンク/i,
  /soft drink/i,
  /炭酸/i,
  /soda/i,
  /ジュース/i,
  /juice/i,
  /お茶/i,
  /tea/i,
  /コーヒー/i,
  /coffee/i,
  /水/i,
  /water/i,
  /ミネラルウォーター/i,
  /mineral water/i,
  /エナジードリンク/i,
  /energy drink/i,
  /スポーツドリンク/i,
  /sports drink/i,
  /機能性飲料/i,
  /functional drink/i,
  /RTD/i,
  /ready to drink/i,
  /ボトル/i,
  /bottle/i,
  /パック/i,
  /pack/i,
  /ペットボトル/i,
  /pet bottle/i,
  /無糖/i,
  /ダブル赤ぶどう/i,
  /ダブル白ぶどう/i,
  /果実/i,
  /フルーツ/i,
  /fruit/i,
  /甘い/i,
  /sweet/i,
  /フレーバー/i,
  /flavor/i,
  /味/i,
  /taste/i,
];

// ブランド名の正規表現パターン
const BRAND_PATTERNS = [
  // サントリー系
  { pattern: /サントリー|Suntory/i, brand: "サントリー" },
  { pattern: /山崎|Yamazaki/i, brand: "サントリー" },
  { pattern: /白州|Hakushu/i, brand: "サントリー" },
  { pattern: /響|Hibiki/i, brand: "サントリー" },
  { pattern: /知多|Chita/i, brand: "サントリー" },
  { pattern: /季|Toki/i, brand: "サントリー" },
  { pattern: /角瓶|Kakubin/i, brand: "サントリー" },
  { pattern: /トリス|Torys/i, brand: "サントリー" },
  { pattern: /白角|Hakukaku/i, brand: "サントリー" },
  
  // ニッカ系
  { pattern: /ニッカ|Nikka/i, brand: "ニッカ" },
  { pattern: /竹鶴|Taketsuru/i, brand: "ニッカ" },
  { pattern: /余市|Yoichi/i, brand: "ニッカ" },
  { pattern: /宮城峡|Miyagikyo/i, brand: "ニッカ" },
  { pattern: /ブラックニッカ/i, brand: "ニッカ" },
  { pattern: /フロム・ザ・バレル|From the Barrel/i, brand: "ニッカ" },
  
  // アサヒ系
  { pattern: /アサヒ|Asahi/i, brand: "アサヒ" },
  { pattern: /スーパードライ|Super Dry/i, brand: "アサヒ" },
  { pattern: /ザ・マスターズ|The Master's/i, brand: "アサヒ" },
];

// 商品リリースかどうかを判定
export function isProductRelease(title: string): boolean {
  const titleLower = title.toLowerCase();
  
  // 除外キーワードをチェック
  for (const excludePattern of EXCLUDE_KEYWORDS) {
    if (excludePattern.test(title)) {
      return false;
    }
  }
  
  // リリースキーワードをチェック
  for (const releasePattern of RELEASE_KEYWORDS) {
    if (releasePattern.test(title)) {
      return true;
    }
  }
  
  return false;
}

// ウイスキー商品かどうかを判定
export function isWhiskyProduct(title: string): boolean {
  // ウイスキー以外の商品カテゴリが含まれている場合は除外
  for (const nonWhiskyPattern of NON_WHISKY_KEYWORDS) {
    if (nonWhiskyPattern.test(title)) {
      return false;
    }
  }
  
  // ウイスキー関連キーワードが含まれている場合はウイスキー商品
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
    /ハイボール/i,
    /highball/i,
  ];
  
  for (const whiskyPattern of whiskyKeywords) {
    if (whiskyPattern.test(title)) {
      return true;
    }
  }
  
  return false;
}

// ウイスキー商品リリースかどうかを判定
export function isWhiskyProductRelease(title: string): boolean {
  return isProductRelease(title) && isWhiskyProduct(title);
}

// ブランド名を抽出
export function extractBrand(title: string): string | null {
  for (const { pattern, brand } of BRAND_PATTERNS) {
    if (pattern.test(title)) {
      return brand;
    }
  }
  return null;
}

// 表現名（商品名）を抽出
export function extractExpression(title: string, brand: string): string {
  let expression = title;
  
  // 1. 振り仮名（括弧内のひらがな・カタカナ）を除去
  expression = expression.replace(/[（(][ぁ-んァ-ヶー]+[）)]/g, '');
  
  // 2. 不要な括弧と記号を除去
  expression = expression
    .replace(/^[「『]/, '') // 先頭の括弧
    .replace(/[」』]$/, '') // 末尾の括弧
    .replace(/^[・\-\s]+/, '') // 先頭の記号・空白
    .replace(/[・\-\s]+$/, '') // 末尾の記号・空白
    .replace(/期間限定新発売$/, '') // 末尾の「期間限定新発売」
    .replace(/新発売$/, '') // 末尾の「新発売」
    .replace(/発売$/, '') // 末尾の「発売」
    .replace(/^[（(]/, '') // 先頭の括弧
    .replace(/[）)]$/, '') // 末尾の括弧
    .replace(/[」』]$/, '') // 末尾の括弧（再度）
    .trim();
  
  // 3. ブランド名を除去（ただし、商品名の一部として使われている場合は残す）
  // 例：「白角ハイボール缶」→「白角」は商品名の一部なので残す
  // 例：「サントリー 白角ハイボール缶」→「サントリー」のみ除去
  
  // 会社名のみを除去（商品名の一部ではない場合）
  const companyNames = [
    /サントリー/i,
    /Suntory/i,
    /ニッカ/i,
    /Nikka/i,
    /アサヒ/i,
    /Asahi/i,
  ];
  
  for (const pattern of companyNames) {
    // 商品名の先頭にある会社名のみを除去
    expression = expression.replace(new RegExp(`^${pattern.source}\\s*`, 'i'), '').trim();
  }
  
  // 4. 再度不要な文字を除去
  expression = expression
    .replace(/^[・\-\s]+/, '') // 先頭の記号・空白
    .replace(/[・\-\s]+$/, '') // 末尾の記号・空白
    .trim();
  
  // 空の場合は元のタイトルを返す
  if (!expression) {
    return title;
  }
  
  return expression;
}

// 全角数字を半角数字に変換
function convertFullWidthToHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

// 発売日を抽出
export function extractReleaseDate(title: string, content?: string): string | null {
  const text = (title + ' ' + (content || '')).toLowerCase();
  
  // 年月日のパターンを検索
  const datePatterns = [
    // 2025年12月2日
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    // 12月2日
    /(\d{1,2})月(\d{1,2})日/,
    // １２月２日（全角数字）
    /([０-９]{1,2})月([０-９]{1,2})日/,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let year = new Date().getFullYear();
      let month = parseInt(convertFullWidthToHalfWidth(match[1]));
      let day = parseInt(convertFullWidthToHalfWidth(match[2]));
      
      // 年が含まれていない場合は現在の年を使用
      if (match.length === 4) {
        year = parseInt(convertFullWidthToHalfWidth(match[1]));
        month = parseInt(convertFullWidthToHalfWidth(match[2]));
        day = parseInt(convertFullWidthToHalfWidth(match[3]));
      }
      
      // 月が12より大きく、現在の月より小さい場合は来年
      if (month > 12) {
        year++;
        month = month - 12;
      } else if (month < new Date().getMonth() + 1) {
        year++;
      }
      
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  
  return null;
}

// 市場を判定
export function determineMarket(source: string, brand: string): string {
  if (source.includes('suntory') || source.includes('prtimes')) {
    return 'JP';
  }
  if (source.includes('asahi')) {
    return 'JP';
  }
  if (source.includes('mom') || source.includes('masterofmalt')) {
    return 'UK';
  }
  return 'Global';
}

// ニュースアイテムからリリースアイテムを生成
export function convertNewsToRelease(newsItem: NewsItem): ReleaseItem | null {
  // ウイスキー商品リリースかどうかを判定
  if (!isWhiskyProductRelease(newsItem.title)) {
    return null;
  }
  
  // ブランド名を抽出
  const brand = extractBrand(newsItem.title);
  if (!brand) {
    return null;
  }
  
  // 表現名を抽出
  const expression = extractExpression(newsItem.title, brand);
  
  // 発売日を抽出
  const releaseDate = extractReleaseDate(newsItem.title);
  
  // 市場を判定
  const market = determineMarket(newsItem.source, brand);
  
  return {
    brand,
    expression,
    announced_date: newsItem.pub_date,
    on_sale_date: releaseDate,
    source_type: "press",
    source_url: newsItem.link,
    market,
    source_org: newsItem.source,
  };
}

// 複数のニュースアイテムを一括変換
export function convertNewsToReleases(newsItems: NewsItem[]): ReleaseItem[] {
  const releases: ReleaseItem[] = [];
  
  for (const newsItem of newsItems) {
    const release = convertNewsToRelease(newsItem);
    if (release) {
      releases.push(release);
    }
  }
  
  return releases;
}
