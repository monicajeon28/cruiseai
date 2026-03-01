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
  const btn = 'px-6 py-3 rounded-lg border text-lg font-semibold';
  const on = btn + ' bg-red-600 text-white border-red-600';
  const off = btn + ' bg-white text-gray-800 border-gray-300 hover:bg-gray-50';
  const disabledClass = disabled ? ' opacity-50 cursor-not-allowed' : '';

  return (
    <div className="flex gap-3 mb-4">
      <button
        className={(value === 'go' ? on : off) + disabledClass}
        onClick={() => !disabled && onChange('go')}
        disabled={disabled}
      >
        크루즈닷 가자
      </button>
      <button
        className={(value === 'show' ? on : off) + disabledClass}
        onClick={() => !disabled && onChange('show')}
        disabled={disabled}
      >
        크루즈닷 보여줘
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
