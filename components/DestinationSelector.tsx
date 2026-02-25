'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import COUNTRIES from '@/data/countries.json';
import PORTS from '@/data/terminals.json';
import ALIASES from '@/data/terminal_aliases.json';

type Props = { onSelectDestination: (value: string) => void; initial?: string };

type Item = { label: string; hay: string };

function buildIndex(): Item[] {
  const list: Item[] = [];
  const push = (label: string, hay: string) => {
    const key = label.trim();
    if (!key) return;
    list.push({ label: key, hay: `${key} ${hay}`.toLowerCase() });
  };

  // 1) 국가
  (COUNTRIES as any[]).forEach(c => {
    const ko = c.koreanName ?? c.nameKo ?? c.name ?? '';
    const en = c.englishName ?? c.nameEn ?? '';
    push(`${ko} (${en})`, `${ko} ${en}`);
  });

  // 2) 항만/터미널
  (PORTS as any[]).forEach(p => {
    const ko = p.name_ko ?? '';
    const city = p.city ?? '';
    const country = p.country ?? '';
    const en = p.name ?? '';
    push(`${country} - ${ko || city} (${en})`, `${ko} ${city} ${country} ${en} ${(p.keywords_ko||[]).join(' ')}`);
  });

  // 3) 별칭 → 동일 터미널에 매핑
  Object.entries(ALIASES as Record<string,string>).forEach(([alias, id]) => {
    const t = (PORTS as any[]).find(p => p.id === id);
    if (t) {
      const ko = t.name_ko ?? '';
      const city = t.city ?? '';
      const country = t.country ?? '';
      const en = t.name ?? '';
      push(`${country} - ${ko || city} (${en})`, `${alias} ${ko} ${city} ${country} ${en}`);
    }
  });

  // 간단 Dedup
  const seen = new Set<string>();
  return list.filter(it => (seen.has(it.label) ? false : (seen.add(it.label), true)));
}

const INDEX = buildIndex();

export default function DestinationSelector({ onSelectDestination, initial = '' }: Props) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return INDEX.slice(0, 30);
    return INDEX.filter(d => d.hay.includes(kw)).slice(0, 50);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', onDoc); return () => document.removeEventListener('click', onDoc);
  }, []);

  const choose = (label: string) => { setQ(label); setOpen(false); onSelectDestination(label); };

  return (
    <div className="relative" ref={boxRef}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, list.length - 1)); }
          if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
          if (e.key === 'Enter' && list[cursor]) { e.preventDefault(); choose(list[cursor].label); }
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-brand-red"
        placeholder="예: 일본 홋카이도 / 요코하마 오산바시 / Singapore"
        autoComplete="off"
      />
      {open && list.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto">
          {list.map((d, i) => (
            <li key={d.label + i} onMouseDown={() => choose(d.label)}
                className={`px-3 py-2 cursor-pointer text-black ${i === cursor ? 'bg-gray-100' : ''}`}>
              {d.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 