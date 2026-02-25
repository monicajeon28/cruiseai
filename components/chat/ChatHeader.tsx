'use client';
import Link from 'next/link';

type Mode = 'go' | 'show' | 'free';

export default function ChatHeader({
    mode, onModeChange,
}: { mode: Mode; onModeChange: (m: Mode) => void }) {
    const Tab = ({ m, label }: { m: Mode; label: string }) => (
        <button
            onClick={() => onModeChange(m)}
            className={[
                "min-h-[48px] px-3 py-2 rounded-lg text-[15px] font-bold border",
                mode === m ? "bg-[#1e40af] text-white border-[#1e40af]"
                    : "bg-white text-gray-900 hover:bg-gray-50"
            ].join(' ')}
        >
            {label}
        </button>
    );
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
                <Tab m="go" label="크루즈닷 가자 (길찾기/지도)" />
                <Tab m="show" label="크루즈닷 보여줘 (사진/설명)" />
                <Tab m="free" label="일반" />
            </div>
            <div className="flex items-center gap-2">
                <Link href="/guide" className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-semibold">사용설명서</Link>
                <Link href="/logout" className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-semibold">로그아웃</Link>
            </div>
        </div>
    );
}
