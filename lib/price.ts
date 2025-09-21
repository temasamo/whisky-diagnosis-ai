export function winsorize(prices: number[], lower=0.05, upper=0.95) {
  if (!prices.length) return { min:null, max:null, pmin:null, pmax:null };
  const arr = [...prices].sort((a,b)=>a-b);
  const q = (p:number) => arr[Math.max(0, Math.min(arr.length-1, Math.floor((arr.length-1)*p)))];
  const pmin = q(lower), pmax = q(upper);
  return { min: arr[0], max: arr[arr.length-1], pmin, pmax };
}
