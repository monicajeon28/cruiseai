'use client';
type Props = { selectedCompanion?: string; onSelectCompanion: (value: string) => void; };
const OPTIONS = ['친구', '인연', '가족', '혼자'];

export default function CompanionSelector({ selectedCompanion, onSelectCompanion }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map(opt => {
        const active = selectedCompanion === opt;
        return (
          <button key={opt} type="button"
                  onClick={() => onSelectCompanion(active ? '' : opt)}
                  className={`px-3 py-2 rounded-full border text-sm ${
                    active ? 'bg-brand-red text-white border-brand-red' : 'bg-white text-black border-gray-300'
                  }`}>
            {opt}
          </button>
        );
      })}
    </div>
  );
} 