import * as React from "react";

type Props = {
  title: string;
  link: string;
  source: string;
  pubDate?: string | null;
  image?: string | null;
  brand?: string | null;
};

export default function WhiskyNewsCard({ title, link, source, pubDate, image, brand }: Props) {
  const dateText = pubDate ? new Date(pubDate).toLocaleDateString("ja-JP") : "";
  const sourceLabel =
    source === "asahi_hd" ? "Asahi Group"
    : source === "asahi_beer" ? "Asahi Beer"
    : source === "prtimes" ? "PR TIMES"
    : source;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-gray-200/70 p-4 hover:shadow-md transition"
    >
      {image ? (
        <div className="mb-3 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="w-full h-40 object-cover" />
        </div>
      ) : null}
      <div className="text-xs text-gray-500">{brand || "Whisky / News"} ・{sourceLabel}</div>
      <div className="mt-1 font-semibold leading-snug">{title}</div>
      <div className="mt-1 text-xs text-gray-500">{dateText}</div>
    </a>
  );
}
