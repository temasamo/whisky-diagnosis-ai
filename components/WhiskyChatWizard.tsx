import { useState } from "react";
import { buildQueryFromAnswers, WhiskyAnswers } from "@/lib/diagnosis";

type Step = 0|1|2|3|4;

const initial: WhiskyAnswers = {
  use:"self", region:"islay", type:"single_malt", peat:"medium",
  cask:["any"], age:"any", drinking:"highball", budget:8000, volume:700
};

export default function WhiskyChatWizard(
  { onSearch }: { onSearch: (q: string, a: WhiskyAnswers) => void }
) {
  const [a, setA] = useState<WhiskyAnswers>(initial);
  const [step, setStep] = useState<Step>(0);

  const next = () => setStep(s => (s < 4 ? (s+1) as Step : s));
  const back = () => setStep(s => (s > 0 ? (s-1) as Step : s));
  const run = () => onSearch(buildQueryFromAnswers(a), a);

  return (
    <div style={{border:'1px solid #ddd', borderRadius:12, padding:16}}>
      <div style={{fontWeight:700, marginBottom:8}}>診断チャット（MVP）</div>
      <div style={{fontSize:12, color:'#666', marginBottom:12}}>Step {step+1} / 5</div>

      {step===0 && (
        <div>
          <div>まずはシーンを教えてください：</div>
          <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
            <button onClick={()=>{setA({...a, use:"self"}); next();}}>自分で飲む</button>
            <button onClick={()=>{setA({...a, use:"gift"}); next();}}>ギフト</button>
          </div>
        </div>
      )}

      {step===1 && (
        <div>
          <div>地域の好みは？</div>
          <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
            {[
              ["アイラ","islay"],["スペイサイド","speyside"],["ハイランド","highland"],
              ["ジャパニーズ","japan"],["こだわらない","any"]
            ].map(([label,val])=>(
              <button key={val} onClick={()=>{setA({...a, region:val as WhiskyAnswers['region']}); next();}}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {step===2 && (
        <div>
          <div>味わいの方向性は？</div>
          <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
            <button onClick={()=>{setA({...a, peat:"none"}); next();}}>ノンピート</button>
            <button onClick={()=>{setA({...a, peat:"light"}); next();}}>控えめ</button>
            <button onClick={()=>{setA({...a, peat:"medium"}); next();}}>ほどよく</button>
            <button onClick={()=>{setA({...a, peat:"heavy"}); next();}}>しっかりスモーキー</button>
          </div>
        </div>
      )}

      {step===3 && (
        <div>
          <div>予算帯は？</div>
          <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
            {[3000,5000,8000,15000,30000].map(v=>(
              <button key={v} onClick={()=>{setA({...a, budget:v as WhiskyAnswers['budget']}); next();}}>
                〜{v.toLocaleString()}円
              </button>
            ))}
          </div>
        </div>
      )}

      {step===4 && (
        <div>
          <div>内容量は？</div>
          <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
            {[500,700,750,1000].map(v=>(
              <button key={v} onClick={()=>{setA({...a, volume:v as WhiskyAnswers['volume']});}}>
                {v}ml
              </button>
            ))}
          </div>
          <div style={{marginTop:16, fontSize:12, color:'#666'}}>
            検索語: {buildQueryFromAnswers(a)}
          </div>
          <div style={{display:'flex', gap:8, marginTop:12}}>
            <button onClick={back}>戻る</button>
            <button onClick={run} style={{fontWeight:700}}>診断して探す</button>
          </div>
        </div>
      )}

      {step>0 && step<4 && (
        <div style={{display:'flex', gap:8, marginTop:16}}>
          <button onClick={back}>戻る</button>
        </div>
      )}

      <style jsx>{`
        button {
          border: 1px solid #ccc; border-radius: 10px; padding: 8px 12px; background:#fff;
        }
        button:hover { background:#f7f7f7 }
      `}</style>
    </div>
  );
}
