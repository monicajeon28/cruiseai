// app/(server)/dday.ts
import 'server-only';
import raw from '@/data/dday_messages.json';

type DdayMessages = { messages: Record<string, { title:string; message:string }> };
const DD: DdayMessages = raw as any;

type OptBase = { customerName: string; cruiseName?: string; destination?: string };
type StartOpt = OptBase & { startDateISO: string };
type EndOpt   = OptBase & { endDateISO: string };

const fill = (s:string,o:OptBase)=>
  s.replaceAll('[고객명]', o.customerName ?? '')
   .replaceAll('[크루즈명]', o.cruiseName ?? '크루즈')
   .replaceAll('[목적지]', o.destination ?? '여행지');

const diff = (iso:string)=>{
  const t=new Date(); t.setHours(0,0,0,0);
  const d=new Date(iso); d.setHours(0,0,0,0);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime()-t.getTime())/86400000);
};

// 출발일 기준: 오늘 D와 **정확히 일치하는 키("100","10","0" 등)**가 있으면 반환
export async function getDdayMessage(o: StartOpt){
  const d = diff(o.startDateISO); if (d==null) return null;
  const row = DD.messages[String(d)]; if (!row) return null;
  return { title: fill(row.title,o), message: fill(row.message,o), days:d };
}

// 종료일 기준: end_1(D-1), end_0(D-0)만
export async function getEnddayMessage(o: EndOpt){
  const d = diff(o.endDateISO); if (d==null) return null;
  const key = d===1?'end_1': d===0?'end_0': null; if(!key) return null;
  const row = DD.messages[key]; if (!row) return null;
  return { title: fill(row.title,o), message: fill(row.message,o), daysToEnd:d };
}

// '나의 정보' 용: 모든 메시지 나열 (숫자 오름차순→end_1→end_0)
export async function getAllDdayMessages(o: OptBase){
  const num: Array<[number,{title:string;message:string}]> = [];
  let e1: any=null, e0: any=null;
  for(const [k,v] of Object.entries(DD.messages)){
    if (k==='end_1') e1=v; else if(k==='end_0') e0=v;
    else if (/^-?\d+$/.test(k)) num.push([parseInt(k,10), v]);
  }
  num.sort((a,b)=>a[0]-b[0]);
  const out: Array<{key:string;title:string;message:string}> = [];
  for(const [k,v] of num) out.push({ key:String(k), title:fill(v.title,o), message:fill(v.message,o) });
  if (e1) out.push({ key:'end_1', title:fill(e1.title,o), message:fill(e1.message,o) });
  if (e0) out.push({ key:'end_0', title:fill(e0.title,o), message:fill(e0.message,o) });
  return out;
}
