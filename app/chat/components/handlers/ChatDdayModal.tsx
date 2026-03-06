'use client';
import React, { useEffect, useState } from 'react';
import { User, Trip } from '@/lib/types'; // Import User and Trip types

type DMap = Record<string, { title:string; message:string }>;
// Removed local Trip and User type definitions

const dDiff = (iso:string) => {
  const a = new Date(iso); a.setHours(0,0,0,0);
  const b = new Date();    b.setHours(0,0,0,0);
  return Math.round((a.getTime()-b.getTime())/86400000);
};
const esc = (s: string) =>
  s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const fill = (s:string, u?:User|null, t?:Trip|null) => {
  const dest = Array.isArray(t?.destination) ? (t!.destination as string[]).join(', ') : String(t?.destination ?? '');
  return (s||'')
    .replaceAll('[고객명]', esc(u?.name ?? ''))
    .replaceAll('[크루즈명]', esc(t?.cruiseName ?? ''))
    .replaceAll('[목적지]', esc(dest));
};

export default function ChatDdayModal({
  user, trip,
}: { user:User|null; trip:Trip|null }) {
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null); // Replaced open, title, html

  useEffect(() => {
    if (!trip?.startDate || !trip?.endDate) return;

    // Type assertion to let TypeScript know that trip is not null and its dates are strings
    const currentTrip = trip as Trip & { startDate: string; endDate: string };

    (async () => {
      const j:{messages:DMap} = await fetch('/data/dday_messages.json', { cache:'no-store' }).then(r=>r.json());
      
      let selectedMessage = null;
      let selectedKey = '';

      const endD = dDiff(currentTrip.endDate); // Use currentTrip here
      if (endD === 1 && j.messages['end_1']) {
        selectedMessage = j.messages['end_1'];
        selectedKey = 'end_1';
      } else if (endD === 0 && j.messages['end_0']) {
        selectedMessage = j.messages['end_0'];
        selectedKey = 'end_0';
      } else {
        const d = dDiff(currentTrip.startDate); // Use currentTrip here
        const key = String([0,1,2,3,7,10,15,20,30,40,50,60,70,80,90,100]
          .find(v => v === d) ?? '');
        selectedMessage = j.messages[key];
        selectedKey = key;
      }

      if (!selectedMessage) return;

      const stamp = new Date().toISOString().slice(0,10);
      const k = `chat_dday_seen_${stamp}_${selectedKey}`;
      if (localStorage.getItem(k)) return; // 하루 1회

      setToast({ // Consolidated state update
        title: fill(selectedMessage.title, user, trip),
        message: fill(selectedMessage.message, user, trip).replace(/\n/g,'<br>'),
      });
      localStorage.setItem(k, '1');
    })();
  }, [trip, user]);

  if (!toast) return null; // Check for toast object
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={()=>setToast(null)} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[92%] max-w-xl p-5 md:p-6">
        <div className="text-[20px] md:text-[22px] font-extrabold mb-2">📣 {toast.title}</div>
        <div className="text-[17px] md:text-[18px] leading-7" dangerouslySetInnerHTML={{ __html: toast.message }} />
        <div className="mt-4 text-right">
          <button className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold" onClick={()=>setToast(null)}>확인</button>
        </div>
      </div>
    </div>
  );
}
