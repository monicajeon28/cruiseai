'use client';

import { useEffect, useState } from 'react';
import { dDiff } from '@/lib/date';
import { User, Trip } from '@/types/app'; // Import global User and Trip types
import { logger } from '@/lib/logger';

type DMap = Record<string, { title: string; message: string }>;
type Row = { dday?: number; emoji?: string; message?: string; d_day?: string; title?: string; message_template?: string };

const FALLBACK_DMAP: DMap = {
  "3": { title: "전자기기 충전 및 확인", message: "[고객명]님, D-3일 남았습니다!\n카메라/보조배터리 충전하고 메모리 카드 확인!" },
  "2": { title: "여행지 날씨 확인", message: "최종 일기예보 확인하고 옷차림 점검해요." },
  "1": { title: "D-1: 드디어 내일!", message: "[크루즈명] [목적지] 여행 출발!\n여권/집합시간 최종 확인하세요." },
  "0": { title: "D-DAY", message: "즐거운 항해 되세요! 🛳️" },
  "end_1": { title: "D-1(귀국): 안전한 귀가", message: "밤에 캐리어 싸고 여권 회수 확인! 하선 방법 선택하세요." },
  "end_0": { title: "귀국일: 마지막 안내", message: "후기 이벤트 참여하고 무사 귀가하세요." }
};

function normalizeRowsToMap(rows: Row[]): DMap {
  const out: DMap = {};
  for (const r of rows) {
    if (r.d_day === 'end-1' || r.d_day === 'end_1') {
      out['end_1'] = { title: r.title ?? 'D-1(귀국)', message: r.message_template ?? '' };
      continue;
    }
    if (r.d_day === 'end-0' || r.d_day === 'end_0') {
      out['end_0'] = { title: r.title ?? '귀국일', message: r.message_template ?? '' };
      continue;
    }
    if (typeof r.dday === 'number') {
      const k = String(r.dday);
      const title = r.title ?? `D-${r.dday}`;
      const msg = fill(`${r.emoji ? r.emoji + ' ' : ''}${r.message ?? ''}`, null, null)
                      .replace(/\n/g, '<br>')
                      .replace(/(\[고객명\]|\[이름\]|\[크루즈명\]|\[목적지\]|D-\d+일)/g, '<strong>$1</strong>');
      out[k] = { title, message: msg };
    }
  }
  return out;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const fill = (s: string, u: User | null, t: Trip | null) => {
  const name = escapeHtml(u?.name ?? '');
  const ship = escapeHtml(t?.cruiseName ?? '');
  const dest = escapeHtml((() => {
    const v = t?.destination as unknown;
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'string') {
      // 혹시 문자열로 JSON 배열이 저장돼 온 경우도 방어
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed.join(', ');
      } catch (e) {
        // JSON.parse 실패 시 오류 무시하고 문자열 그대로 반환
      }
      return v;
    }
    return '';
  })());

  return (s || '')
    .replaceAll('[고객명]', name)
    .replaceAll('[이름]', name)
    .replaceAll('[크루즈명]', ship)
    .replaceAll('[목적지]', dest);
};

interface DdayPopupProps {
  initialUser: User | null; // Use global User type
  initialTrip: Trip | null; // Use global Trip type
}

export default function DdayPopup({ initialUser, initialTrip }: DdayPopupProps) {
  const [popup, setPopup] = useState<{ title: string; html: string } | null>(null);
  const [dmap, setDmap] = useState<DMap | null>(null);
  const [user, setUser] = useState<User | null>(initialUser);
  const [trip, setTrip] = useState<Trip | null>(initialTrip);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/data/dday_messages.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();

        let normalized: DMap | null = null;
        if (Array.isArray(raw)) {
          normalized = normalizeRowsToMap(raw as Row[]);
        } else if (Array.isArray(raw?.messages)) {
          normalized = normalizeRowsToMap(raw.messages as Row[]);
        } else if (raw?.messages && typeof raw.messages === 'object') {
          normalized = raw.messages as DMap;
        }

        if (!normalized || Object.keys(normalized).length === 0) {
          logger.warn('D-Day JSON 빈 값 또는 포맷 오작동. 화면에 표시할 데이터가 없습니다.');
          setDmap(FALLBACK_DMAP); // 빈 경우 폴백 사용
          return;
        }
        setDmap(normalized);
      } catch (e) {
        logger.error('D-Day JSON 로드 실패');
        setDmap(FALLBACK_DMAP); // 실패 시 폴백 사용
      }
    })();
  }, []);

  useEffect(() => {
    if (!dmap || !user || !trip) return; // dmap, user, trip이 모두 로드되었을 때만 실행

    const startD = dDiff(trip.startDate);
    const endD = dDiff(trip.endDate);
    const nums = Object.keys(dmap).map(k => Number(k)).filter(n => !Number.isNaN(n)).sort((a, b) => a - b);

    if (startD === null) return;

    const key = `genie-dday-popup:${new Date().toISOString().slice(0, 10)}`;
    if (typeof window !== 'undefined' && localStorage.getItem(key)) return; // 오늘은 이미 노출

    let pick: { title: string; message: string } | null = null;

    if (endD === 1 && dmap['end_1']) {
      pick = dmap['end_1'];
    } else if (endD === 0 && dmap['end_0']) {
      pick = dmap['end_0'];
    } else {
      let pickKey: number | null = null;
      if (nums.includes(startD)) pickKey = startD;
      else pickKey = nums.find(n => n >= startD) ?? null;

      if (pickKey != null) {
        pick = dmap[String(pickKey)];
      }
    }

    if (!pick) return; // 팝업 메시지 선택 실패

    const titleHtml = fill(pick.title, user, trip).replace(/\n/g, '<br>')
      .replace(/(\[고객명\]|\[이름\]|\[크루즈명\]|\[목적지\]|D-\d+일)/g, '<strong class="text-red-600">$1</strong>');
    const messageHtml = fill(pick.message, user, trip).replace(/\n/g, '<br>')
      .replace(/(\[고객명\]|\[이름\]|\[크루즈명\]|\[목적지\]|D-\d+일)/g, '<strong>$1</strong>');

    const styledHtml = `
      <div class="text-xl font-extrabold mb-2">${titleHtml}</div>
      <div class="text-lg leading-relaxed [&>strong]:bg-yellow-200 [&>strong]:px-1">
        ${messageHtml}
      </div>
    `;

    setPopup({ title: pick.title, html: styledHtml });
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, '1');
    }
  }, [dmap, user, trip]);

  if (!popup) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-5">
        <div className="text-lg font-extrabold mb-2">크루즈닷 알림</div>
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: popup.html }} />
        <button onClick={() => setPopup(null)} className="mt-4 w-full h-11 rounded-lg bg-red-600 text-white font-semibold">확인</button>
      </div>
    </div>
  );
}
