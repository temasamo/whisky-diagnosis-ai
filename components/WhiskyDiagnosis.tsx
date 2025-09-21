import { useState } from "react";
import { buildQueryFromAnswers, WhiskyAnswers } from "@/lib/diagnosis";

export default function WhiskyDiagnosis({ onSearch }: { onSearch: (q: string, a: WhiskyAnswers)=>void }) {
  const [answers, setAnswers] = useState<WhiskyAnswers>({
    use:"self", region:"islay", type:"single_malt", peat:"medium",
    cask:["any"], age:"any", drinking:"highball", budget:8000, volume:700
  });

  const set = (patch: Partial<WhiskyAnswers>) => setAnswers(prev => ({...prev, ...patch}));

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <div className="font-semibold">ウイスキー診断（MVP）</div>
      <div className="grid md:grid-cols-3 gap-3">
        <label>地域
          <select className="w-full border rounded px-2 py-1" value={answers.region} onChange={e=>set({region:e.target.value as any})}>
            {["islay","speyside","highland","japan","ireland","bourbon","rye","campbeltown","lowland","any"].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>タイプ
          <select className="w-full border rounded px-2 py-1" value={answers.type} onChange={e=>set({type:e.target.value as any})}>
            {["single_malt","blended","grain","bourbon","rye","cask_strength","any"].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>ピート
          <select className="w-full border rounded px-2 py-1" value={answers.peat} onChange={e=>set({peat:e.target.value as any})}>
            {["none","light","medium","heavy","any"].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>年数
          <select className="w-full border rounded px-2 py-1" value={answers.age} onChange={e=>set({age:e.target.value as any})}>
            {["nas","10","12","15","18","21","25","any"].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>予算
          <select className="w-full border rounded px-2 py-1" value={answers.budget} onChange={e=>set({budget:Number(e.target.value) as any})}>
            {[3000,5000,8000,15000,30000,60000].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>内容量
          <select className="w-full border rounded px-2 py-1" value={answers.volume} onChange={e=>set({volume:Number(e.target.value) as any})}>
            {[500,700,750,1000].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded bg-black text-white"
          onClick={() => onSearch(buildQueryFromAnswers(answers), answers)}
        >診断して探す</button>
        <div className="text-sm text-gray-500 self-center">検索語: {buildQueryFromAnswers(answers)}</div>
      </div>
    </div>
  );
}
