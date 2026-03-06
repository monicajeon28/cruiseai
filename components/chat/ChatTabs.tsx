'use client';

type TabKey = 'go' | 'show' | 'general' | 'info' | 'translate' | 'free';

export function ChatTabs({
  value,
  onChange,
  disabled,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
  disabled?: boolean;
}) {
  const base = 'py-3.5 rounded-lg border text-lg font-semibold text-center leading-tight transition-colors';
  const on = base + ' bg-red-600 text-white border-red-600';
  const off = base + ' bg-white text-gray-800 border-gray-300 hover:bg-gray-50';
  const disabledClass = disabled ? ' opacity-50 cursor-not-allowed' : '';

  return (
    <div className="grid grid-cols-3 gap-1.5 mb-4">
      <button
        className={(value === 'go' ? on : off) + disabledClass}
        onClick={() => !disabled && onChange('go')}
        disabled={disabled}
      >
        <span className="block">크루즈닷</span>
        <span className="block">가자</span>
      </button>
      <button
        className={(value === 'show' ? on : off) + disabledClass}
        onClick={() => !disabled && onChange('show')}
        disabled={disabled}
      >
        <span className="block">크루즈닷</span>
        <span className="block">보여줘</span>
      </button>
      <button
        className={(value === 'general' ? on : off) + disabledClass}
        onClick={() => !disabled && onChange('general')}
        disabled={disabled}
      >
        일반
      </button>
    </div>
  );
}
