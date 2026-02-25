"use client"
import { ReactNode } from 'react'


// API 응답 타입 (page.tsx에서 직접 받아서 렌더링)
export type NavResolvedData =
  | { type: 'pick'; message: string; from: { query: string; candidates: { id: string; label: string }[] }; to: { query: string; candidates: { id: string; label: string }[] } }
  | { type: 'routes'; from: string; to: string; routes: { transit: string; driving: string; mapview: string } };

interface NavHandlerProps {
  res: NavResolvedData;
  onPick: (slot: 'from' | 'to', item: { id: string; label: string }) => void; // 칩 선택 시 콜백
}

// --- 내부 컴포넌트 정의 ---
const Card = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <div className="rounded-2xl bg-gray-100 p-3">
    <div className="mb-2 text-sm font-medium text-gray-800">{title}</div>
    {subtitle && <div className="mb-2 text-sm text-gray-600">{subtitle}</div>}
    {children}
  </div>
);

const Buttons = ({ items, onClick }: { items: { id: string; label: string }[]; onClick: (id: string, label: string) => void }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <button
        key={item.id}
        onClick={() => onClick(item.id, item.label)}
        className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
      >
        {item.label}
      </button>
    ))}
  </div>
);

const NavRoutesCard = ({ title, subtitle, links }: { title: string; subtitle: string; links: { transit: string; driving: string; mapview: string } }) => (
  <Card title={title} subtitle={subtitle}>
    <div className="flex flex-wrap gap-2">
      <a
        target="_blank"
        href={links.transit}
        className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:opacity-90"
      >
        대중교통
      </a>
      <a
        target="_blank"
        href={links.driving}
        className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:opacity-90"
      >
        자동차
      </a>
      <a
        target="_blank"
        href={links.mapview}
        className="rounded-full bg-green-600 px-4 py-2 text-sm text-white hover:opacity-90"
      >
        지도로 보기
      </a>
    </div>
  </Card>
);

// --- 메인 컴포넌트 (NavHandler로 변경) ---
export default function NavHandler({ res, onPick }: NavHandlerProps) {

  // ✅ 1) 출발지/도착지 선택 단계 (type: 'pick')
  if (res.type === 'pick') {
    return (
      <Card title={res.message}>
        {res.from.candidates.length > 0 && (
          <div className="mb-4">
            <div className="font-medium text-gray-700 mb-2">출발지 후보:</div>
            <Buttons
              items={res.from.candidates}
              onClick={(id, label) => onPick('from', { id, label })}
            />
          </div>
        )}
        {res.to.candidates.length > 0 && (
          <div>
            <div className="font-medium text-gray-700 mb-2">도착지 후보:</div>
            <Buttons
              items={res.to.candidates}
              onClick={(id, label) => onPick('to', { id, label })}
            />
          </div>
        )}
      </Card>
    );
  }

  // ✅ 2) 길찾기 링크 표시 단계 (type: 'routes')
  if (res.type === 'routes') {
    return (
      <NavRoutesCard
        title="길찾기 링크"
        subtitle={`출발: ${res.from} → 도착: ${res.to}`}
        links={res.routes}
      />
    );
  }

  return null;
}





