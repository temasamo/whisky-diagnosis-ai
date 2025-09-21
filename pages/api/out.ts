import type { NextApiRequest, NextApiResponse } from "next";

type Mall = "rakuten" | "yahoo" | "amazon";

const PROVIDER = process.env.RAKUTEN_PROVIDER || "official"; // ← デフォルトofficialに
const MOSHIMO_A_ID = process.env.MOSHIMO_A_ID!;
const MOSHIMO_P_ID = process.env.MOSHIMO_P_ID!;
const MOSHIMO_PC_ID = process.env.MOSHIMO_PC_ID!;
const MOSHIMO_PL_ID = process.env.MOSHIMO_PL_ID!;

const RAKUTEN_AFFIL_ID = process.env.RAKUTEN_AFFILIATE_ID || "";

const YAHOO_VC_SID = process.env.YAHOO_VC_SID!;
const YAHOO_VC_PID = process.env.YAHOO_VC_PID!;

const AMAZON_BASE = process.env.NEXT_PUBLIC_AMAZON_ENTRANCE_URL || "https://www.amazon.co.jp/";
const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG || "";

const enc = (s: string) => encodeURIComponent(s);

// --- 楽天：もしも（旧） ---
function buildRakutenMoshimo(url: string) {
  return `https://af.moshimo.com/af/c/click?a_id=${MOSHIMO_A_ID}&p_id=${MOSHIMO_P_ID}&pc_id=${MOSHIMO_PC_ID}&pl_id=${MOSHIMO_PL_ID}&url=${enc(url)}`;
}

// --- 楽天：公式（推奨） ---
// 仕様： https://hb.afl.rakuten.co.jp/hgc/<AFFIL_ID>/?pc=<商品URL>&m=<商品URL>
// （pc=PC用リンク、m=モバイル用。両方同じでOK）
function buildRakutenOfficial(url: string) {
  if (!RAKUTEN_AFFIL_ID) throw new Error("RAKUTEN_AFFILIATE_ID is missing");
  const base = `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFIL_ID}/`;
  return `${base}?pc=${enc(url)}&m=${enc(url)}`;
}

// --- Yahoo：ValueCommerce ---
function buildYahooVC(url: string) {
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${YAHOO_VC_SID}&pid=${YAHOO_VC_PID}&vc_url=${enc(url)}`;
}

// 楽天以外のURLかどうかをチェック
function isRakutenUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('rakuten.co.jp') || urlObj.hostname.includes('rakuten.com');
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const mall = String(req.query.mall || "") as Mall;
    const url = typeof req.query.url === "string" ? req.query.url : "";

    let finalUrl = "";
    if (mall === "rakuten") {
      if (!url) throw new Error("url is required for rakuten");
      
      // 楽天以外のURLの場合は直接リダイレクト（アフィリエイトを使わない）
      if (!isRakutenUrl(url)) {
        finalUrl = url;
      } else {
        finalUrl = PROVIDER === "moshimo" ? buildRakutenMoshimo(url) : buildRakutenOfficial(url);
      }
    } else if (mall === "yahoo") {
      if (!url) throw new Error("url is required for yahoo");
      finalUrl = buildYahooVC(url);
    } else if (mall === "amazon") {
      const u = new URL(AMAZON_BASE);
      if (AMAZON_TAG && !u.searchParams.get("tag")) u.searchParams.set("tag", AMAZON_TAG);
      finalUrl = u.toString();
    } else {
      throw new Error("unknown mall");
    }

    res.writeHead(302, { Location: finalUrl });
    res.end();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "bad_request" });
  }
}
