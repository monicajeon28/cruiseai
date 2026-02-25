'use client';
import { gmDirUrl, gmSearchUrl } from '@/lib/maps';
import type { LatLng } from '@/lib/maps';

type Props = {
  originText: string;
  destText: string;
  urls: { transit: string; driving: string; walking: string };
  onSend: (text: string) => void; // onSend 콜백 추가
};

export default function GoActionsCard({ originText, destText, urls, onSend }: Props) {
  const base =
    'flex-1 min-h-[64px] rounded-xl border px-4 py-3 ' +
    'text-[18px] sm:text-[20px] font-extrabold ' +
    'bg-white hover:bg-gray-50 active:scale-[0.99] ' +
    'flex items-center justify-center gap-2';

  return (
    <div className="w-full my-2">
      <div className="mb-2 text-[16px] sm:text-[18px]">
        <span className="font-bold">🧭 경로 안내:</span>{' '
        }<span className="font-bold text-brand-red">{originText}</span>
        <span> → </span>
        <span className="font-bold text-brand-red">{destText}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <a className={`${base} ring-2 ring-blue-200`} href={urls.transit} target="_blank" rel="noopener noreferrer" aria-label="대중교통 길찾기">
          🚇 대중교통
        </a>
        <a className={`${base} ring-2 ring-emerald-200`} href={urls.driving} target="_blank" rel="noopener noreferrer" aria-label="자동차 길찾기">
          🚗 자동차
        </a>
        <a className={`${base} ring-2 ring-amber-200`} href={urls.walking} target="_blank" rel="noopener noreferrer" aria-label="지도 보기">
          🗺️ 지도보기
        </a>
      </div>
      <div className="mt-2 text-[14px] sm:text-[16px] text-gray-600">
        <span className="font-semibold">TIP:</span>{' '}
        출발∙도착지를 바꾸고 싶으면 문장만 다시 입력하세요. (예: <mark 
          className="bg-yellow-200 px-1 rounded cursor-pointer hover:bg-yellow-300"
          onClick={() => onSend('인천공항에서 카이탁까지')}
        >인천공항에서 카이탁까지</mark>)
      </div>
    </div>
  );
}


