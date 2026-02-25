/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiCheckCircle,
  FiEdit2,
  FiFileText,
  FiFolderPlus,
  FiImage,
  FiPlus,
  FiTrash2,
  FiUploadCloud,
  FiVideo,
  FiX,
} from "react-icons/fi";
import { isAllowedCruisedotMallId } from "@/lib/cruisedot-news-access";
import {
  cloneNewsBlock,
  createNewsBlockByType,
  normalizeNewsBlock,
  type AddableNewsBlockType,
} from "@/lib/cruisedot-news-editor";
import {
  buildNewsHtml,
  DEFAULT_NEWS_BLOCKS,
  DEFAULT_NEWS_HIGHLIGHT,
  DEFAULT_NEWS_TITLE,
  NEWS_TEMPLATE_STYLE,
  type NewsBlock,
} from "@/lib/cruisedot-news-template";

const MEDIA_ROOT_LABEL = "[크루즈정보사진]";
const LOCKED_TYPES = new Set<NewsBlock["type"]>(["intro"]);

type MediaFile = {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
};

type MediaDirectory = {
  name: string;
  path: string;
};

const BLOCK_LABELS: Record<NewsBlock["type"], string> = {
  intro: "인트로",
  video: "영상",
  section: "텍스트 섹션",
  callout: "콜아웃",
  image: "이미지",
  summary: "요약",
  info: "정보",
};

const BLOCK_ADD_OPTIONS: { type: AddableNewsBlockType; label: string; description: string; icon: ReactNode }[] = [
  {
    type: "section",
    label: "텍스트 섹션",
    description: "소제목·본문·불릿을 빠르게 구성",
    icon: <FiFileText className="text-lg" />,
  },
  {
    type: "video",
    label: "영상",
    description: "YouTube 등 임베드 링크를 입력",
    icon: <FiVideo className="text-lg" />,
  },
  {
    type: "image",
    label: "이미지",
    description: `${MEDIA_ROOT_LABEL} 라이브러리 연동`,
    icon: <FiImage className="text-lg" />,
  },
  {
    type: "callout",
    label: "콜아웃",
    description: "체크포인트 강조 박스",
    icon: <FiAlertCircle className="text-lg" />,
  },
  {
    type: "summary",
    label: "마무리 요약",
    description: "CTA와 핵심을 정리",
    icon: <FiCheckCircle className="text-lg" />,
  },
];

const canWriteCruisedotNews = (role?: string | null) => {
  return (role ?? "").toLowerCase() === "admin";
};

const renderBlockPreview = (block: NewsBlock) => {
  switch (block.type) {
    case "intro":
      return (
        <section className="news-intro">
          <div className="intro-kicker">{block.kicker}</div>
          <p className="intro-lead">{block.lead}</p>
        </section>
      );
    case "video":
      return (
        <section className="news-video-block">
          <div className="video-frame">
            <iframe
              src={block.url}
              title="Cruisedot HQ Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <p className="media-caption">{block.caption}</p>
        </section>
      );
    case "section":
      return (
        <article className="news-section-block">
          <h2>{block.heading}</h2>
          <p>{block.body}</p>
          {block.listItems.length > 0 && (
            <ul className="news-list">
              {block.listItems.map((item, index) => (
                <li key={`${block.id}-item-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </article>
      );
    case "callout":
      return (
        <section className="news-callout">
          <h3>{block.title}</h3>
          <p>{block.body}</p>
        </section>
      );
    case "image":
      return (
        <figure className="news-image-block">
          {block.src ? (
            <img src={block.src} alt={block.alt || block.caption || "Cruisedot image"} />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-3xl border border-dashed border-rose-200 bg-rose-50/50 text-sm text-rose-400">
              이미지를 선택하세요.
            </div>
          )}
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case "summary":
      return (
        <section className="news-summary">
          <h3>{block.title}</h3>
          <p>{block.body}</p>
        </section>
      );
    default:
      return null;
  }
};

const cloneForEdit = <T extends NewsBlock>(block: T): T => JSON.parse(JSON.stringify(block));

export default function CruisedotNewsWritePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [title, setTitle] = useState(DEFAULT_NEWS_TITLE);
  const [highlight, setHighlight] = useState(DEFAULT_NEWS_HIGHLIGHT);
  const [blocks, setBlocks] = useState<NewsBlock[]>(() => DEFAULT_NEWS_BLOCKS.map(cloneNewsBlock));
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [imagePickerState, setImagePickerState] = useState<
    | {
      open: true;
      onSelect: (path: string) => void;
      suggestedSubfolder?: string;
    }
    | null
  >(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const role = data?.user?.role ?? "";
        if (canWriteCruisedotNews(role)) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
          router.replace("/community");
        }
      })
      .catch(() => {
        setAuthorized(false);
        router.replace("/community");
      });
  }, [router]);

  const editingBlock = useMemo(
    () => (editingBlockId ? blocks.find((block) => block.id === editingBlockId) ?? null : null),
    [blocks, editingBlockId]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setStatusMessage("제목을 입력해주세요.");
      return;
    }

    const finalHtml = buildNewsHtml({
      title: title.trim(),
      highlight: highlight.trim(),
      blocks: blocks.map((block) => normalizeNewsBlock(block)),
    });

    try {
      setSubmitting(true);
      setStatusMessage("HQ 칼럼을 업로드하는 중입니다…");
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          content: finalHtml,
          category: "cruisedot-news",
          images: ["/images/ai-cruise-logo.png"],
        }),
      });
      const data = await response.json();
      if (!data.ok) {
        setStatusMessage(data.error || "업로드에 실패했습니다.");
        setSubmitting(false);
        return;
      }
      setStatusMessage("업로드가 완료되었습니다.");
      setTimeout(() => {
        router.push("/community/cruisedot-news");
      }, 600);
    } catch (error: any) {
      console.error("[Cruisedot News Write] Submit error:", error);
      setStatusMessage(error?.message || "업로드에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBlock = (blockId: string) => {
    const target = blocks.find((block) => block.id === blockId);
    if (!target) return;
    if (LOCKED_TYPES.has(target.type)) {
      setStatusMessage("인트로 블록은 삭제할 수 없습니다.");
      return;
    }
    setBlocks((prev) => prev.filter((block) => block.id !== blockId));
  };

  const handleSaveBlock = (updated: NewsBlock) => {
    setBlocks((prev) => prev.map((block) => (block.id === updated.id ? normalizeNewsBlock(updated) : block)));
    setEditingBlockId(null);
  };

  const handleAddBlock = (type: AddableNewsBlockType) => {
    const newBlock = createNewsBlockByType(type);
    setBlocks((prev) => [...prev, newBlock]);
    setShowAddMenu(false);
    setEditingBlockId(newBlock.id);
  };

  const openImagePicker = (applyPath: (path: string) => void, suggestedSubfolder?: string) => {
    setImagePickerState({
      open: true,
      onSelect: (path) => {
        applyPath(path);
        setImagePickerState(null);
      },
      suggestedSubfolder,
    });
  };

  const resetTemplate = () => {
    setTitle(DEFAULT_NEWS_TITLE);
    setHighlight(DEFAULT_NEWS_HIGHLIGHT);
    setBlocks(DEFAULT_NEWS_BLOCKS.map(cloneNewsBlock));
    setStatusMessage("템플릿을 초기화했습니다.");
  };

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-slate-50">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white/70 px-10 py-12 shadow-lg backdrop-blur">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
            <p className="text-sm font-medium text-slate-500">본사 계정 확인 중입니다...</p>
          </div>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-slate-50 py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
        <Link
          href="/community/cruisedot-news"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-rose-500 transition hover:-translate-x-1"
        >
          <FiArrowLeft />
          크루즈닷늬우스 목록으로
        </Link>

        <form onSubmit={handleSubmit} className="space-y-10">
          <header className="rounded-[32px] border border-rose-100 bg-white/95 p-8 shadow-xl shadow-rose-200/40 backdrop-blur">
            <h1 className="text-3xl font-extrabold text-slate-900 md:text-[2.6rem]">크루즈닷늬우스 칼럼 작성</h1>
            <p className="mt-3 text-sm text-slate-500">
              기본 템플릿 위에 텍스트·영상·이미지를 빠르게 교체하고, 필요한 디자인 블록을 추가해 주세요. (관리자 전용)
            </p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-400">칼럼 제목</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-base font-semibold text-slate-900 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-400">하이라이트 문장</span>
                <textarea
                  value={highlight}
                  onChange={(event) => setHighlight(event.target.value)}
                  rows={3}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-base text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetTemplate}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
              >
                <FiFolderPlus />
                템플릿 초기화
              </button>
            </div>
          </header>

          <section className="relative rounded-[36px] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/30 md:p-10">
            <style dangerouslySetInnerHTML={{ __html: NEWS_TEMPLATE_STYLE }} />
            <div className="news-wrapper relative border border-transparent bg-transparent p-0 shadow-none">
              <header className="mb-8">
                <h1 className="news-title text-slate-900">{title || "제목을 입력하세요"}</h1>
              </header>
              {highlight.trim() && <div className="news-highlight">{highlight}</div>}

              <main className="news-content">
                {blocks.map((block, index) => (
                  <div key={block.id} className="group relative">
                    {renderBlockPreview(block)}
                    <div className="pointer-events-none absolute right-4 top-4 flex gap-2 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditingBlockId(block.id)}
                        className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-rose-500 shadow"
                      >
                        <FiEdit2 /> 편집
                      </button>
                      {blocks.length > 1 && !LOCKED_TYPES.has(block.type) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(block.id)}
                          className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-500 shadow hover:text-rose-500"
                        >
                          <FiTrash2 /> 삭제
                        </button>
                      )}
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-400">
                      #{index + 1} · {BLOCK_LABELS[block.type]}
                    </div>
                  </div>
                ))}
              </main>

              <div className="mt-10 flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowAddMenu((prev) => !prev)}
                  className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-300/60 transition hover:-translate-y-0.5"
                >
                  <FiPlus /> 디자인 블록 추가하기
                </button>
                {showAddMenu && (
                  <div className="flex w-full flex-wrap justify-center gap-4 rounded-3xl border border-rose-100 bg-rose-50/70 p-6 shadow-inner">
                    {BLOCK_ADD_OPTIONS.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => handleAddBlock(option.type)}
                        className="flex w-full max-w-[220px] flex-col gap-2 rounded-2xl bg-white px-5 py-4 text-left text-sm font-semibold text-slate-600 shadow transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <span className="flex items-center gap-2 text-rose-500">
                          {option.icon} {option.label}
                        </span>
                        <span className="text-xs font-medium text-slate-400">{option.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {statusMessage && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-semibold text-rose-600 shadow-inner">
              {statusMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Link
              href="/community/cruisedot-news"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-300 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-400"
            >
              <FiCheck />
              {submitting ? "업로드 중…" : "HQ 칼럼 발행"}
            </button>
          </div>
        </form>
      </div>

      {editingBlock && (
        <BlockEditorModal
          block={editingBlock}
          onClose={() => setEditingBlockId(null)}
          onSave={handleSaveBlock}
          onRequestImageSelect={openImagePicker}
        />
      )}

      {imagePickerState && (
        <ImageLibraryModal
          open={imagePickerState.open}
          onClose={() => setImagePickerState(null)}
          onSelect={imagePickerState.onSelect}
          suggestedSubfolder={imagePickerState.suggestedSubfolder}
        />
      )}
    </div>
  );
}

type BlockEditorModalProps = {
  block: NewsBlock;
  onClose: () => void;
  onSave: (block: NewsBlock) => void;
  onRequestImageSelect: (applyPath: (path: string) => void, suggestedSubfolder?: string) => void;
};

function BlockEditorModal({ block, onClose, onSave, onRequestImageSelect }: BlockEditorModalProps) {
  const [draft, setDraft] = useState<NewsBlock>(() => cloneForEdit(block));

  useEffect(() => {
    setDraft(cloneForEdit(block));
  }, [block]);

  const updateDraft = (partial: Partial<NewsBlock>) => {
    setDraft((prev) => ({ ...(prev as any), ...(partial as any) } as NewsBlock));
  };

  const handleListItemChange = (index: number, value: string) => {
    if (draft.type !== "section") return;
    setDraft((prev) => {
      if (prev.type !== "section") return prev;
      const listItems = [...prev.listItems];
      listItems[index] = value;
      return { ...prev, listItems };
    });
  };

  const handleAddListItem = () => {
    if (draft.type !== "section") return;
    setDraft((prev) => {
      if (prev.type !== "section") return prev;
      return { ...prev, listItems: [...prev.listItems, ""] };
    });
  };

  const handleRemoveListItem = (index: number) => {
    if (draft.type !== "section") return;
    setDraft((prev) => {
      if (prev.type !== "section") return prev;
      return { ...prev, listItems: prev.listItems.filter((_, idx) => idx !== index) };
    });
  };

  const handleSave = () => {
    onSave(normalizeNewsBlock(draft));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[32px] border border-rose-100 bg-white/95 p-8 shadow-2xl shadow-rose-200/50">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{BLOCK_LABELS[block.type]} 블록 편집</h2>
            <p className="mt-1 text-sm text-slate-500">변경 내용을 저장하면 미리보기와 최종 HTML에 즉시 반영됩니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <FiX />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
          {draft.type === "intro" && (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">키워드 태그</span>
                <input
                  value={draft.kicker}
                  onChange={(event) => updateDraft({ kicker: event.target.value })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">인트로 문장</span>
                <textarea
                  value={draft.lead}
                  onChange={(event) => updateDraft({ lead: event.target.value })}
                  rows={3}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
            </>
          )}

          {draft.type === "video" && (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">영상 URL (iframe src)</span>
                <input
                  value={draft.url}
                  onChange={(event) => updateDraft({ url: event.target.value })}
                  placeholder="https://www.youtube.com/embed/..."
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">영상 설명</span>
                <input
                  value={draft.caption}
                  onChange={(event) => updateDraft({ caption: event.target.value })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
            </>
          )}

          {draft.type === "section" && (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">소제목</span>
                <input
                  value={draft.heading}
                  onChange={(event) => updateDraft({ heading: event.target.value })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">본문</span>
                <textarea
                  value={draft.body}
                  onChange={(event) => updateDraft({ body: event.target.value })}
                  rows={4}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">핵심 불릿</span>
                  <button
                    type="button"
                    onClick={handleAddListItem}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                  >
                    <FiPlus /> 항목 추가
                  </button>
                </div>
                {draft.listItems.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-400">
                    불릿이 없으면 본문만 노출됩니다.
                  </p>
                )}
                {draft.listItems.map((item, index) => (
                  <div key={`${draft.id}-list-${index}`} className="flex items-start gap-2">
                    <span className="mt-2 text-xs font-semibold text-rose-400">•</span>
                    <textarea
                      value={item}
                      onChange={(event) => handleListItemChange(index, event.target.value)}
                      rows={2}
                      className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveListItem(index)}
                      className="rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-100"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {draft.type === "callout" && (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">제목</span>
                <input
                  value={draft.title}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">내용</span>
                <textarea
                  value={draft.body}
                  onChange={(event) => updateDraft({ body: event.target.value })}
                  rows={3}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
            </>
          )}

          {draft.type === "image" && (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">이미지 경로</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onRequestImageSelect((path) => updateDraft({ src: path }))}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50"
                    >
                      <FiImage />
                      라이브러리 열기
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestImageSelect((path) => updateDraft({ src: path }), "")}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      <FiUploadCloud /> 새 업로드
                    </button>
                  </div>
                </div>
                <input
                  value={draft.src}
                  onChange={(event) => updateDraft({ src: event.target.value })}
                  placeholder="/크루즈정보사진/ 또는 외부 URL"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">대체 텍스트</span>
                <input
                  value={draft.alt}
                  onChange={(event) => updateDraft({ alt: event.target.value })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">캡션</span>
                <input
                  value={draft.caption}
                  onChange={(event) => updateDraft({ caption: event.target.value })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
            </>
          )}

          {draft.type === "summary" && (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">제목</span>
                <input
                  value={draft.title}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500">본문</span>
                <textarea
                  value={draft.body}
                  onChange={(event) => updateDraft({ body: event.target.value })}
                  rows={3}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-300 hover:bg-rose-500"
          >
            <FiCheck /> 저장
          </button>
        </div>
      </div>
    </div>
  );
}

type ImageLibraryModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  suggestedSubfolder?: string;
};

function ImageLibraryModal({ open, onClose, onSelect, suggestedSubfolder }: ImageLibraryModalProps) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [directories, setDirectories] = useState<MediaDirectory[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState<string>("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [subfolderInput, setSubfolderInput] = useState<string>(suggestedSubfolder ?? "");
  const [filenameInput, setFilenameInput] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<{ path: string; name: string } | null>(null);

  const normalizedFilter = folderFilter.trim().toLowerCase();
  const filteredDirectories = useMemo(() => {
    if (!normalizedFilter) return directories;
    return directories.filter((directory) => directory.path.toLowerCase().includes(normalizedFilter));
  }, [directories, normalizedFilter]);

  useEffect(() => {
    if (selectedDirectory === "all") return;
    if (!filteredDirectories.some((directory) => directory.path === selectedDirectory)) {
      if (filteredDirectories.length > 0) {
        setSelectedDirectory(filteredDirectories[0].path);
      } else {
        setSelectedDirectory("all");
      }
    }
  }, [filteredDirectories, selectedDirectory]);

  const loadLibrary = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/uploads/cruisedot", { cache: "no-store" });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error || "라이브러리를 불러오지 못했습니다.");
        return;
      }
      setFiles(data.files ?? []);
      setDirectories(data.directories ?? []);
    } catch (err: any) {
      setError(err?.message || "라이브러리를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadLibrary();
      if (suggestedSubfolder) {
        setSubfolderInput(suggestedSubfolder.replace(/^\/ ?크루즈정보사진\/?/, ""));
      }
    }
    if (!open) {
      setPreviewImage(null);
      setFolderFilter("");
      setSelectedDirectory("all");
    }
  }, [open, suggestedSubfolder]);

  const filteredFiles = useMemo(() => {
    if (selectedDirectory === "all") {
      if (!normalizedFilter) return files;
      return files.filter((file) => file.path.toLowerCase().includes(normalizedFilter));
    }
    return files.filter((file) => file.path.startsWith(selectedDirectory));
  }, [files, selectedDirectory, normalizedFilter]);

  if (!open) {
    return null;
  }

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fileInputRef.current?.files?.length) {
      setError("업로드할 파일을 선택해 주세요.");
      return;
    }

    const file = fileInputRef.current.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("subfolder", subfolderInput);
    formData.append("filename", filenameInput);

    try {
      setUploading(true);
      setError("");
      const response = await fetch("/api/uploads/cruisedot", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error || "업로드에 실패했습니다.");
        return;
      }
      await loadLibrary();
      if (data.file?.path) {
        onSelect(data.file.path);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-[32px] border border-slate-100 bg-white/97 p-8 shadow-2xl shadow-slate-400/30">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{MEDIA_ROOT_LABEL} 라이브러리</h2>
            <p className="mt-1 text-sm text-slate-500">기존 이미지를 선택하거나 새 이미지를 업로드하세요.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <FiX />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            폴더 선택
            <select
              value={selectedDirectory}
              onChange={(event) => setSelectedDirectory(event.target.value)}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            >
              <option value="all">전체</option>
              {filteredDirectories.map((directory) => (
                <option key={directory.path} value={directory.path}>
                  {directory.path.replace(/^\/?크루즈정보사진\/?/, "") || "루트"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            폴더 필터
            <input
              value={folderFilter}
              onChange={(event) => setFolderFilter(event.target.value)}
              placeholder="폴더명을 검색하세요"
              className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>
        </div>

        <div className="mt-6 max-h-[40vh] overflow-y-auto rounded-3xl border border-slate-100 bg-slate-50/60 p-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">불러오는 중...</div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              해당 폴더에 저장된 이미지가 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {filteredFiles.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => {
                    onSelect(file.path);
                    onClose();
                  }}
                  onMouseEnter={() => setPreviewImage({ path: file.path, name: file.name })}
                  onMouseLeave={() => setPreviewImage(null)}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                    <img src={file.path} alt={file.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-col gap-1 px-4 py-3 text-left">
                    <span className="text-sm font-semibold text-slate-700">{file.name}</span>
                    <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleUpload} className="mt-6 rounded-3xl border border-slate-100 bg-slate-50/80 p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-600">새 이미지 업로드</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-500">저장 폴더 (선택)</span>
              <input
                value={subfolderInput}
                onChange={(event) => setSubfolderInput(event.target.value)}
                placeholder="예) 2025/봄프로모션"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-500">파일 이름 (확장자 제외, 선택)</span>
              <input
                value={filenameInput}
                onChange={(event) => setFilenameInput(event.target.value)}
                placeholder="예) cruise-hero"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="text-sm text-slate-600" />
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-300"
            >
              <FiUploadCloud /> {uploading ? "업로드 중…" : "업로드"}
            </button>
          </div>
        </form>
      </div>
      {previewImage && (
        <div className="fixed bottom-8 right-8 z-50 w-64 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl">
          <div className="mb-2 text-xs font-semibold text-slate-500">{previewImage.name}</div>
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <img src={previewImage.path} alt={previewImage.name} className="h-40 w-full object-cover" />
          </div>
        </div>
      )}
    </div>
  );
}