import {
  DEFAULT_NEWS_BLOCKS,
  DEFAULT_NEWS_HIGHLIGHT,
  DEFAULT_NEWS_TITLE,
  type NewsBlock,
  type NewsCalloutBlock,
  type NewsImageBlock,
  type NewsIntroBlock,
  type NewsSectionBlock,
  type NewsSummaryBlock,
  type NewsVideoBlock,
} from "./cruisedot-news-template";

const randomString = () => Math.random().toString(36).slice(2, 10);

const generateUuid = () => {
  if (typeof globalThis !== "undefined" && globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return (globalThis.crypto.randomUUID as () => string)();
  }
  return `${Date.now()}-${randomString()}`;
};

export const createNewsBlockId = (prefix: string) => `${prefix}-${generateUuid().replace(/-/g, "")}`;

export const cloneNewsBlock = (block: NewsBlock): NewsBlock => {
  switch (block.type) {
    case "intro":
      return { ...block, id: createNewsBlockId("intro") } as NewsIntroBlock;
    case "video":
      return { ...block, id: createNewsBlockId("video") } as NewsVideoBlock;
    case "section":
      return {
        ...block,
        id: createNewsBlockId("section"),
        listItems: [...block.listItems],
      } as NewsSectionBlock;
    case "callout":
      return { ...block, id: createNewsBlockId("callout") } as NewsCalloutBlock;
    case "image":
      return { ...block, id: createNewsBlockId("image") } as NewsImageBlock;
    case "summary":
      return { ...block, id: createNewsBlockId("summary") } as NewsSummaryBlock;
    default:
      return block;
  }
};

export type AddableNewsBlockType = Exclude<NewsBlock["type"], "intro">;

export const createNewsBlockByType = (type: AddableNewsBlockType): NewsBlock => {
  switch (type) {
    case "section":
      return {
        id: createNewsBlockId("section"),
        type: "section",
        heading: "새 소제목을 입력하세요",
        body: "본문을 입력하세요. 데이터와 인사이트, 고객 사례를 넣으면 설득력이 높아집니다.",
        listItems: [],
      } satisfies NewsSectionBlock;
    case "video":
      return {
        id: createNewsBlockId("video"),
        type: "video",
        url: "https://www.youtube.com/embed/QkC4Ymf7CR8?rel=0&mute=1&controls=1",
        caption: "영상 설명을 입력하세요.",
        autoplay: false,
        mute: true,
      } satisfies NewsVideoBlock;
    case "image":
      return {
        id: createNewsBlockId("image"),
        type: "image",
        src: "",
        alt: "이미지 대체 텍스트를 입력하세요.",
        caption: "이미지 설명을 입력하세요.",
      } satisfies NewsImageBlock;
    case "callout":
      return {
        id: createNewsBlockId("callout"),
        type: "callout",
        title: "CHECK POINT",
        body: "핵심 메시지를 2~3문장으로 요약하세요.",
      } satisfies NewsCalloutBlock;
    case "summary":
      return {
        id: createNewsBlockId("summary"),
        type: "summary",
        title: "마무리 정리",
        body: "본문 핵심을 요약하고 다음 행동(Call to Action)을 안내하세요.",
      } satisfies NewsSummaryBlock;
    default:
      return createNewsBlockByType("section");
  }
};

export const normalizeNewsBlock = (block: NewsBlock): NewsBlock => {
  switch (block.type) {
    case "intro":
      return { ...block, kicker: block.kicker.trim(), lead: block.lead.trim() };
    case "video":
      return { ...block, url: block.url.trim(), caption: block.caption.trim() };
    case "section":
      return {
        ...block,
        heading: block.heading.trim(),
        body: block.body.trim(),
        listItems: block.listItems.map((item) => item.trim()).filter(Boolean),
      };
    case "callout":
      return { ...block, title: block.title.trim(), body: block.body.trim() };
    case "image":
      return { ...block, src: block.src.trim(), alt: block.alt.trim(), caption: block.caption.trim() };
    case "summary":
      return { ...block, title: block.title.trim(), body: block.body.trim() };
    default:
      return block;
  }
};

export type ParsedNewsTemplate = {
  title: string;
  highlight: string;
  blocks: NewsBlock[];
};

const fallbackTemplate = (): ParsedNewsTemplate => ({
  title: DEFAULT_NEWS_TITLE,
  highlight: DEFAULT_NEWS_HIGHLIGHT,
  blocks: DEFAULT_NEWS_BLOCKS.map(cloneNewsBlock),
});

export const parseNewsHtmlToTemplate = (html: string | null | undefined): ParsedNewsTemplate => {
  if (!html || typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return fallbackTemplate();
  }

  try {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const title = doc.querySelector(".news-title")?.textContent?.trim() || DEFAULT_NEWS_TITLE;
    const highlight = doc.querySelector(".news-highlight")?.textContent?.trim() || "";
    const content = doc.querySelector("main.news-content");
    if (!content) {
      return {
        title,
        highlight,
        blocks: DEFAULT_NEWS_BLOCKS.map(cloneNewsBlock),
      };
    }

    const blocks: NewsBlock[] = [];
    Array.from(content.children).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains("news-intro")) {
        const kicker = node.querySelector(".intro-kicker")?.textContent?.trim() || "[KEYWORD] HQ INSIGHT";
        const lead = node.querySelector(".intro-lead")?.textContent?.trim() || DEFAULT_NEWS_HIGHLIGHT;
        blocks.push({
          id: createNewsBlockId("intro"),
          type: "intro",
          kicker,
          lead,
        } satisfies NewsIntroBlock);
      } else if (node.classList.contains("news-video-block")) {
        const iframe = node.querySelector("iframe");
        const caption = node.querySelector(".media-caption")?.textContent?.trim() || "";
        if (iframe?.getAttribute("src")) {
          blocks.push({
            id: createNewsBlockId("video"),
            type: "video",
            url: iframe.getAttribute("src") ?? "",
            caption,
            autoplay: iframe.hasAttribute("autoplay"),
            mute: iframe.hasAttribute("data-muted") || iframe.getAttribute("src")?.includes("mute=1") || false,
          } satisfies NewsVideoBlock);
        }
      } else if (node.classList.contains("news-section-block")) {
        const heading = node.querySelector("h2")?.textContent?.trim() || "새 소제목을 입력하세요";
        const body = node.querySelector("p")?.textContent?.trim() || "본문을 입력하세요.";
        const listItems = Array.from(node.querySelectorAll(".news-list li")).map((li) =>
          li.textContent?.trim() || ""
        );
        blocks.push({
          id: createNewsBlockId("section"),
          type: "section",
          heading,
          body,
          listItems: listItems.filter(Boolean),
        } satisfies NewsSectionBlock);
      } else if (node.classList.contains("news-callout")) {
        const titleText = node.querySelector("h3")?.textContent?.trim() || "CHECK POINT";
        const bodyText = node.querySelector("p")?.textContent?.trim() || "";
        blocks.push({
          id: createNewsBlockId("callout"),
          type: "callout",
          title: titleText,
          body: bodyText,
        } satisfies NewsCalloutBlock);
      } else if (node.classList.contains("news-image-block")) {
        const img = node.querySelector("img");
        const caption = node.querySelector("figcaption")?.textContent?.trim() || "";
        if (img?.getAttribute("src")) {
          blocks.push({
            id: createNewsBlockId("image"),
            type: "image",
            src: img.getAttribute("src") ?? "",
            alt: img.getAttribute("alt")?.trim() || "",
            caption,
          } satisfies NewsImageBlock);
        }
      } else if (node.classList.contains("news-summary")) {
        const titleText = node.querySelector("h3")?.textContent?.trim() || "마무리 정리";
        const bodyText = node.querySelector("p")?.textContent?.trim() || "";
        blocks.push({
          id: createNewsBlockId("summary"),
          type: "summary",
          title: titleText,
          body: bodyText,
        } satisfies NewsSummaryBlock);
      }
    });

    return {
      title,
      highlight,
      blocks: blocks.length > 0 ? blocks : DEFAULT_NEWS_BLOCKS.map(cloneNewsBlock),
    };
  } catch (error) {
    console.warn("[Cruisedot Parser] Failed to parse HTML:", error);
    return fallbackTemplate();
  }
};


