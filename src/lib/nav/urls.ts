export function gmapsDir(origin: string, dest: string, mode: 'driving'|'transit') {
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api','1');
  u.searchParams.set('origin', origin);
  u.searchParams.set('destination', dest);
  u.searchParams.set('travelmode', mode);
  return u.toString();
}
export function gmapsSearch(query: string) {
  const u = new URL('https://www.google.com/maps/search/');
  u.searchParams.set('api','1');
  u.searchParams.set('query', query);
  return u.toString();
}

// 레거시 별칭 호환
export const buildDrivingUrl = (o:string,d:string) => gmapsDir(o,d,'driving');
export const buildTransitUrl = (o:string,d:string) => gmapsDir(o,d,'transit');
export const buildMapUrl     = (q:string)         => gmapsSearch(q);
