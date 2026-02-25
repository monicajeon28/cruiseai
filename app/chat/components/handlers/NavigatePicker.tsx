'use client';

type Props = {
  onPick: (v: { from?: string; to?: string }) => void;
  defaultFrom?: string;
  defaultTo?: string;
};

export default function NavigatePicker(p: Props) {
  // 최소 동작 보장: 나중에 실제 자동완성/연관버튼 연결
  return (
    <div className="flex gap-2">
      <input
        defaultValue={p.defaultFrom}
        placeholder="출발지"
        className="flex-1 input input-bordered"
        onChange={(e) => p.onPick({ from: e.target.value })}
      />
      <span>→</span>
      <input
        defaultValue={p.defaultTo}
        placeholder="도착지"
        className="flex-1 input input-bordered"
        onChange={(e) => p.onPick({ to: e.target.value })}
      />
    </div>
  );
}
