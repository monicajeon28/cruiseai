'use client';

type Props = {
  where: 'greet'|'input';
  hint?: string;
  onPick: (text:string)=>void;
};

const base = [
  '크루즈닷 미국 크루즈 터미널 어떻게 가?',
  '인천공항에서 카이탁 크루즈 터미널까지',
  '일본 항만 크루즈 터미널 어딨어?',
];

function buildFromHint(h?:string) {
  if (!h) return [];
  if (/공항|터미널|가는 ?법|가는길|가는 길/.test(h)) {
    return [
      `${h} 자동차 경로`,
      `${h} 대중교통 경로`,
      `${h} 택시 요금`,
    ];
  }
  if (/미국|일본|한국|대만|홍콩/.test(h)) {
    return [`${h} 크루즈 터미널 위치`, `${h} 출항 터미널`, `${h} 항만 코드`];
  }
  return [];
}

export default function SuggestChips({ where, hint, onPick }:Props) {
  const items = where==='greet' ? base : buildFromHint(hint);
  if (!items.length) return null;
  return (
    <div className="flex gap-3 flex-wrap mt-2">
      {items.map((t, i)=>(<button
          key={i}
          onClick={()=>onPick(t)}
          className="
            px-5 py-4
            rounded-xl
            border-2
            text-lg font-bold
            min-h-[70px]
            bg-white
            hover:bg-gray-50
            hover:border-blue-400
            active:scale-95
            transition-all
            shadow-sm
            hover:shadow-md
          "
        >
          {t}
        </button>
      ))}
    </div>
  );
}
