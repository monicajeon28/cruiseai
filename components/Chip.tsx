type ChipProps = { label: string; onClick: () => void; emoji?: string; className?:string };

export function Chip({ label, onClick, emoji, className }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-blue-400 hover:bg-blue-50
                 rounded-full px-4 py-2 text-[16px] font-semibold text-gray-900 ${className||''}`}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </button>
  );
}

