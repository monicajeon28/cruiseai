'use client';

type TabKey = 'go' | 'show' | 'general' | 'info' | 'translate' | 'free';

export function ChatTabs({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
}) {
  const btn = 'px-6 py-3 rounded-lg border text-lg font-semibold';
  const on = btn + ' bg-red-600 text-white border-red-600';
  const off = btn + ' bg-white text-gray-800 border-gray-300 hover:bg-gray-50';

  return (
    <div className="flex gap-3 mb-4">
      <button className={value === 'go' ? on : off} onClick={() => onChange('go')}>크루즈닷 가자</button>
      <button className={value === 'show' ? on : off} onClick={() => onChange('show')}>크루즈닷 보여줘</button>
      <button className={value === 'general' ? on : off} onClick={() => onChange('general')}>일반</button>
    </div>
  );
}
