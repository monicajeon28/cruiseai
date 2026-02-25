'use client';

// 이 파일의 url 함수는 더 이상 사용되지 않습니다. (route.ts에서 gmapDirUrl 사용)
// function url(dir: 'drive'|'transit'|'walk', origin?: string, dest?: string) {
//   const base = 'https://www.google.com/maps/dir/';
//   const params = new URLSearchParams();
//   if (origin) params.set('origin', origin);
//   if (dest)   params.set('destination', dest);
//   if (dir==='transit') params.set('travelmode','transit');
//   if (dir==='walk')    params.set('travelmode','walking');
//   return `${base}?${params.toString()}`;
// }

interface Route {
  label: string;
  url: string;
}

export default function DirectionsButtons({
  routes,
}: { routes: Route[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {routes.map((route, i) => (
        <a key={i}
           className="min-h-[48px] px-3 py-3 rounded-xl bg-brand-red text-white font-bold text-[16px] hover:bg-red-600"
           href={route.url} target="_blank" rel="noopener noreferrer">
          {route.label}
        </a>
      ))}
    </div>
  );
}
