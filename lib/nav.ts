export type XY = { lat:number; lng:number };

export function gmapDir(dest:XY, mode:'driving'|'transit'|'walking', origin?: XY|string) {
  const d = `${dest.lat},${dest.lng}`;
  let url = `https://www.google.com/maps/dir/?api=1&destination=${d}&travelmode=${mode}`;
  if (origin){
    url += `&origin=${typeof origin==='string'
      ? encodeURIComponent(origin) : `${origin.lat},${origin.lng}`}`;
  }
  return url;
}
export const gmapPlace = (xy:XY, z=16)=>`https://www.google.com/maps/@${xy.lat},${xy.lng},${z}z`;
export const gmapNearby = (kw:string,xy:XY)=>`https://www.google.com/maps/search/${encodeURIComponent(kw)}/@${xy.lat},${xy.lng},16z`;

export function buildNavHTML(to:XY, origin?:XY|string){
  const arr = [
    { label:'🚗 자동차 길찾기', url:gmapDir(to,'driving',origin) },
    { label:'🚌 대중교통 길찾기', url:gmapDir(to,'transit',origin) },
    { label:'🚶 도보 길찾기',   url:gmapDir(to,'walking',origin) },
    { label:'🗺️ 지도에서 위치 보기', url:gmapPlace(to) },
  ];
  return arr.map(b=>`<a target="_blank" href="${b.url}"
    class="inline-flex items-center justify-center px-3 py-2 mr-2 my-1 rounded-xl bg-blue-600 text-white">${b.label}</a>`).join('');
}

export function buildNearbyHTML(to:XY){
  return ['스타벅스','편의점','식당','버스정류장','지하철역'].map(k =>
    `<a target="_blank" href="${gmapNearby(k,to)}"
      class="inline-flex items-center justify-center px-3 py-2 mr-2 my-1 rounded-xl border bg-white">🔎 ${k} 검색</a>`
  ).join('');
}

// “A에서 B까지” 파서
export function parseAB(q:string){
  const pat = /(.*?)(?:에서|서|from)\s+(.*?)(?:까지|로|to|가는\s*길|가는길)/i;
  const m = q.replace(/\s+/g,' ').trim().match(pat);
  return m ? { from: m[1].trim(), to: m[2].trim() } : null;
}


















