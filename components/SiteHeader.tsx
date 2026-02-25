'use client';
import React, { useEffect, useState, useRef } from 'react'
import { Trip } from '@/lib/types'; // Import Trip type

type DMap = Record<string, { title:string; message:string }>

function dDiff(iso?: string) {
  if (!iso) return null
  const a = new Date(iso); a.setHours(0,0,0,0)
  const b = new Date(); b.setHours(0,0,0,0)
  return Math.round((a.getTime()-b.getTime())/86400000)
}

export default function SiteHeader() {
  const [trip, setTrip] = useState<Trip | null>(null) // Use Trip type
  const [dmap, setDmap] = useState<DMap | null>(null)
  const [popup, setPopup] = useState<{title:string; html:string} | null>(null)

  const inited = useRef(false);

  useEffect(()=>{ 
    if (inited.current) return;
    inited.current = true;

    (async()=>{
    const t = await fetch('/api/trips',{credentials:'include'}).then(r=>r.json()).then(j=>j.trip ?? j?.trip ?? null).catch(()=>null)
    setTrip(t)
    const m = await fetch('/data/dday_messages.json',{cache:'no-store'}).then(r=>r.json()).then(j=>j.messages).catch(()=>null)
    setDmap(m)
  })() },[])

  useEffect(()=>{ 
    if (!trip || !dmap) return
    if (!trip.startDate) return

    const key = `dday_popup_${trip.startDate}_${new Date().toISOString().slice(0,10)}`
    if (localStorage.getItem(key)) return

    const startD = dDiff(trip.startDate)!
    const endD   = dDiff(trip.endDate || '') ?? 999

    let pick: string | null = null
    if (endD === 1 && dmap['end_1']) pick = 'end_1'
    else if (endD === 0 && dmap['end_0']) pick = 'end_0'
    else if (dmap[String(startD)]) pick = String(startD)
    else {
      const nums = Object.keys(dmap).map(k=>Number(k)).filter(n=>!Number.isNaN(n)).sort((a,b)=>a-b)
      const next = nums.find(n=>n>=startD)
      if (next!=null) pick = String(next)
    }

    if (pick) {
      const msg = dmap[pick]
      const name = (trip.user?.name) || '고객'
      const html = (msg.message || '').replaceAll('[고객명]', name).replaceAll('\n','<br>')
      setPopup({ title: msg.title, html })
      localStorage.setItem(key,'1')
    }
  },[trip, dmap])

  return (
    <>
      {/* 기존 상단 … */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-xl w-[92%] rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-[22px] md:text-[24px] font-extrabold leading-snug mb-3">
              {popup.title}
            </div>
            <div className="text-[17px] md:text-[18px] leading-8"
                 dangerouslySetInnerHTML={{ __html: popup.html }}/>
            <div className="mt-5 text-right">
              <button onClick={()=>setPopup(null)}
                className="px-5 py-2 rounded-lg bg-red-500 text-white text-[16px] font-bold">확인</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
