export function gmapDir(from: string, to: string, mode: 'driving'|'transit') {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=${mode}`;
}

export function gmapSearch(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function gmapPlace(placeId: string) {
  return `https://www.google.com/maps/search/?api=1&query=place_id:${encodeURIComponent(placeId)}`;
}
