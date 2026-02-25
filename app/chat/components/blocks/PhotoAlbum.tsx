'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import PhotoAlbumModal from '../../../../components/PhotoAlbumModal';
import ImageViewerModal from '../../../../components/ImageViewerModal';

export type Item = { url: string; title?: string; tags?: string[] };

const isFile = (seg: string) => /\.[a-z0-9]{1,6}$/i.test(seg); // 마지막 세그먼트가 파일명인지 판별

function dissect(url: string) {
  const clean = decodeURI(url.split('?')[0]);
  const parts = clean.split('/').filter(Boolean);
  const idx = parts.indexOf('크루즈정보사진');
  const segs = idx >= 0 ? parts.slice(idx + 1) : parts;
  const last = segs[segs.length - 1] || '';
  const folderSegs = isFile(last) ? segs.slice(0, -1) : segs;
  const root = folderSegs[0] || '기타';
  const sub  = folderSegs[1] || null;
  return { root, sub, folderSegs };
}

export type PhotoAlbumProps = {
  items: Item[];
  query?: string;
};

export default function PhotoAlbum({ items, query }: PhotoAlbumProps) {
  const { rootOrder, rootToAll, rootToSubs } = useMemo(() => {
    const rootToAll  = new Map<string, string[]>();
    const rootToSubs = new Map<string, Map<string, string[]>>();

    for (const it of items || []) {
      const { root, sub } = dissect(it.url);
      const all = rootToAll.get(root) || [];
      all.push(it.url);
      rootToAll.set(root, all);

      if (sub) {
        const subs = rootToSubs.get(root) || new Map<string, string[]>();
        const arr = subs.get(sub) || [];
        arr.push(it.url);
        subs.set(sub, arr);
        rootToSubs.set(root, subs);
      }
    }

    const roots = Array.from(rootToAll.keys());
    roots.sort((a,b) => (rootToAll.get(b)?.length || 0) - (rootToAll.get(a)?.length || 0));

    return { rootOrder: roots, rootToAll, rootToSubs };
  }, [items]);

  const [activeRoot, setActiveRoot] = useState<string>(() => {
    const qn = (query || '').toLowerCase();
    return rootOrder.find(r => r.toLowerCase().includes(qn)) || rootOrder[0] || '';
  });

  const subMap = rootToSubs.get(activeRoot) || new Map<string, string[]>();
  const subs = useMemo(() => {
    const entries = Array.from(subMap.entries());
    entries.sort((a,b)=> b[1].length - a[1].length);
    const list = entries.map(([name, arr]) => ({ name, count: arr.length }));
    const total = rootToAll.get(activeRoot)?.length || 0;
    return [{ name: '전체', count: total }, ...list];
  }, [subMap, activeRoot, rootToAll]);

  const [activeSub, setActiveSub] = useState<string>('전체');

  const allForRoot = rootToAll.get(activeRoot) || [];
  const currentImages = activeSub === '전체' ? allForRoot : (subMap.get(activeSub) || []);
  const preview = currentImages.slice(0, 9);

  const [albumOpen, setAlbumOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);

  const openViewer = (idx: number) => { setViewerIdx(idx); setViewerOpen(true); };

  if (!items?.length) {
    return <div className="text-sm text-gray-500">결과가 없어요.</div>;
  }

  return (
    <div className="space-y-4">
      {/* 상위 폴더 버튼 (나라/지역) - 크게! */}
      {rootOrder.length > 1 && (
        <div>
          <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span>📂</span>
            <span>지역 선택</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {rootOrder.map((r) => (
              <button
                key={r}
                onClick={() => { setActiveRoot(r); setActiveSub('전체'); }}
                className={`
                  px-5 py-4
                  rounded-xl
                  border-2
                  text-base font-bold
                  min-h-[70px]
                  ${r === activeRoot 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg' 
                    : 'bg-white text-gray-800 border-gray-300 hover:border-blue-400 hover:shadow-md'
                  }
                  active:scale-95
                  transition-all
                `}
                title={`${r} (${rootToAll.get(r)?.length || 0}장)`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">{r}</span>
                  <span className="text-xs opacity-80">{rootToAll.get(r)?.length || 0}장</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 하위 폴더 버튼 (세부 분류) - 크게! */}
      <div>
        <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span>🏷️</span>
          <span>세부 분류</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {subs.map(s => (
            <button
              key={s.name}
              onClick={() => setActiveSub(s.name)}
              className={`
                px-5 py-4
                rounded-xl
                border-2
                text-base font-bold
                min-h-[65px]
                ${s.name === activeSub 
                  ? 'bg-purple-600 text-white border-purple-600 shadow-lg' 
                  : 'bg-white text-gray-800 border-gray-300 hover:border-purple-400 hover:shadow-md'
                }
                active:scale-95
                transition-all
              `}
              title={`${s.name} (${s.count}장)`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-base">{s.name}</span>
                <span className="text-xs opacity-80">{s.count}장</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
        <p className="text-base text-gray-800">
          💡 <b>팁</b>: 사진을 클릭하면 크게 볼 수 있어요!
        </p>
      </div>

      {/* 사진 썸네일 - 더 크게! */}
      {preview.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {preview.map((url, i) => (
            <div
              key={url}
              className="
                relative w-full aspect-square
                cursor-pointer
                rounded-xl
                overflow-hidden
                shadow-md
                hover:shadow-2xl
                hover:scale-105
                transition-all
                border-2 border-gray-200
                hover:border-blue-400
              "
              onClick={() => openViewer(i)}
            >
              <Image
                src={url}
                alt=""
                fill
                className="object-cover"
                quality={75}
                loading="lazy"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-6 bg-gray-50 rounded-xl">
          <span className="text-4xl mb-2">📷</span>
          <p className="text-base text-gray-500">결과가 없어요.</p>
        </div>
      )}

      {/* 전체 보기 버튼 - 크게! */}
      {currentImages.length > 9 && (
        <div className="text-center">
          <button
            onClick={() => { setAlbumOpen(true); }}
            className="
              inline-flex items-center gap-2
              px-6 py-4
              rounded-xl
              bg-gradient-to-r from-blue-600 to-purple-600
              text-white
              text-lg font-bold
              shadow-lg
              hover:shadow-xl
              hover:from-blue-700 hover:to-purple-700
              active:scale-95
              transition-all
              min-h-[60px]
            "
          >
            <span className="text-2xl">📸</span>
            <span>{currentImages.length}장의 사진 모두 보기</span>
          </button>
        </div>
      )}

      <PhotoAlbumModal
        open={albumOpen}
        onClose={() => setAlbumOpen(false)}
        images={currentImages}
        onImageClick={(_, idx) => { setAlbumOpen(false); openViewer(idx); }}
      />

      <ImageViewerModal
        open={viewerOpen}
        images={currentImages}
        index={viewerIdx}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}