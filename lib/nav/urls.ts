export function gmapsDir(origin: string, destination: string, mode: 'driving'|'transit'|'walking' = 'driving') {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
}
export function gmapsNearby(keyword: string, near?: string) {
  const q = near ? `${keyword} near ${near}` : keyword;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
