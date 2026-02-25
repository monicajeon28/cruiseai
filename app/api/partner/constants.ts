// 클라이언트와 서버 모두에서 사용 가능한 상수들

export type AffiliateLeadStatus = 'NEW' | 'CONTACTED' | 'IN_PROGRESS' | 'PURCHASED' | 'REFUNDED' | 'CLOSED' | 'TEST_GUIDE';

export const leadStatusOptions: Array<{
  value: AffiliateLeadStatus;
  label: string;
  theme: string;
}> = [
  { value: 'NEW', label: '신규', theme: 'bg-blue-100 text-blue-700' },
  { value: 'CONTACTED', label: '소통중', theme: 'bg-amber-100 text-amber-700' },
  { value: 'IN_PROGRESS', label: '진행 중', theme: 'bg-indigo-100 text-indigo-700' },
  { value: 'PURCHASED', label: '구매 완료', theme: 'bg-emerald-100 text-emerald-700' },
  { value: 'REFUNDED', label: '환불', theme: 'bg-rose-100 text-rose-700' },
  { value: 'CLOSED', label: '종료', theme: 'bg-slate-100 text-slate-600' },
  { value: 'TEST_GUIDE', label: '3일부재', theme: 'bg-yellow-100 text-yellow-700' },
];
