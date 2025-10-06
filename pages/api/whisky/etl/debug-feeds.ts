import type { NextApiRequest, NextApiResponse } from "next";
import { XMLParser } from "fast-xml-parser";

const CANDS = [
  { name: "ASAHI_GROUP", url: process.env.ASAHI_RSS_GROUP },
  { name: "PRTIMES_NIKKA_KW", url: process.env.PRTIMES_RSS_NIKKA_KW },
  { name: "PRTIMES_ASAHI_KW", url: process.env.PRTIMES_RSS_ASAHI_KW },
  { name: "PRTIMES_MAIN",  url: process.env.PRTIMES_RSS_MAIN },
];

async function fetchText(url: string) {
  const res = await fetch(url!, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      "Referer": "https://www.asahigroup-holdings.com/",
    },
    redirect: "follow",
    cache: "no-store",
  });
  return { status: res.status, type: res.headers.get("content-type") || "", text: await res.text() };
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const out:any[] = [];
  for (const c of CANDS) {
    if (!c.url) continue;
    try {
      const r = await fetchText(c.url);
      let items = 0;
      try {
        const js = parser.parse(r.text);
        const rss = js?.rss?.channel?.item;
        const rdf = js?.rdf?.item || js?.["rdf:RDF"]?.item;
        const arr = Array.isArray(rss) ? rss : rss ? [rss] : Array.isArray(rdf) ? rdf : rdf ? [rdf] : [];
        items = arr.length;
      } catch {}
      out.push({ name: c.name, url: c.url, status: r.status, type: r.type, items });
    } catch (e:any) {
      out.push({ name: c.name, url: c.url, error: e.message });
    }
  }
  res.status(200).json(out);
};
