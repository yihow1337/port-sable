// One seeded random number generator (mulberry32) feeds the city, the traffic, the crowd, the
// police and every spark, so `?seed=1` paints the same frame every time a screenshot is taken.
/** A deterministic generator returning floats in [0, 1). */
export function createRandom(seed){let a=(seed|0)^0x9e3779b9;return function random(){a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
export function range(random,low,high){return low+random()*(high-low);}
export function rangeInt(random,low,high){return low+Math.floor(random()*(high-low+1));}
export function pick(random,list){return list[Math.floor(random()*list.length)%list.length];}
export function chance(random,probability){return random()<probability;}
export function direction(random){const angle=random()*Math.PI*2;return{x:Math.cos(angle),y:Math.sin(angle)};}
