export type NewsIntroBlock = {
  id: string;
  type: "intro";
  kicker: string;
  lead: string;
};

export type NewsVideoBlock = {
  id: string;
  type: "video";
  url: string;
  caption: string;
  autoplay: boolean;
  mute: boolean;
};

export type NewsSectionBlock = {
  id: string;
  type: "section";
  heading: string;
  body: string;
  listItems: string[];
};

export type NewsCalloutBlock = {
  id: string;
  type: "callout";
  title: string;
  body: string;
};

export type NewsImageBlock = {
  id: string;
  type: "image";
  src: string;
  alt: string;
  caption: string;
};

export type NewsSummaryBlock = {
  id: string;
  type: "summary";
  title: string;
  body: string;
};

export type NewsInfoBlock = {
  id: string;
  type: "info";
  weather?: { temp: number; description: string; icon: string };
  exchangeRate?: { usd: number; eur: number; jpy: number };
  stockMarket?: { kospi: number; kosdaq: number; nasdaq: number };
};

export type NewsBlock =
  | NewsIntroBlock
  | NewsVideoBlock
  | NewsSectionBlock
  | NewsCalloutBlock
  | NewsImageBlock
  | NewsSummaryBlock
  | NewsInfoBlock;

export const NEWS_TEMPLATE_STYLE = `
  :root {
    --news-bg: #f6f8fc;
    --news-surface: #ffffff;
    --news-accent: #f43f5e;
    --news-accent-soft: #fee2e2;
    --news-text: #1f2937;
    --news-muted: #6b7280;
    --news-radius: 28px;
  }
  * {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    font-family: "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background-color: var(--news-bg);
    color: var(--news-text);
    line-height: 2.4;
    font-size: 19px;
    word-break: keep-all;
    letter-spacing: -0.01em;
  }
  .news-wrapper {
    max-width: 880px;
    margin: 0 auto;
    padding: 54px 32px 120px;
    background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.75));
    border-radius: var(--news-radius);
    box-shadow: 0 28px 60px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(12px);
  }
  .news-intro {
    text-align: center;
    margin-bottom: 48px;
  }
  .news-intro .intro-kicker {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--news-accent);
    background: var(--news-accent-soft);
    border-radius: 999px;
    padding: 10px 20px;
    font-weight: 700;
  }
  .news-intro .intro-lead {
    margin-top: 24px;
    font-size: 22px;
    font-weight: 600;
    color: var(--news-text);
  }
  .news-highlight {
    margin: 0 auto 40px;
    max-width: 720px;
    padding: 28px 32px;
    background: linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(244, 63, 94, 0.28));
    border-radius: calc(var(--news-radius) - 6px);
    border: 1px solid rgba(244, 63, 94, 0.22);
    color: #be123c;
    font-weight: 600;
    text-align: center;
    line-height: 1.7;
  }
  .news-video-block {
    margin: 0 auto 56px;
    border-radius: calc(var(--news-radius) - 4px);
    overflow: hidden;
    background: #0f172a;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.28);
  }
  .news-video-block .video-frame {
    position: relative;
    width: 100%;
    padding-top: 56.25%;
  }
  .news-video-block iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }
  .media-caption {
    margin: 0;
    padding: 18px 22px;
    font-size: 14px;
    color: #f8fafc;
    background: rgba(15, 23, 42, 0.85);
    text-align: center;
  }
  .news-content {
    display: flex;
    flex-direction: column;
    gap: 48px;
  }
  .news-section-block h2 {
    font-family: "Noto Serif KR", serif;
    font-size: 32px;
    line-height: 1.4;
    color: #111827;
    margin-bottom: 18px;
  }
  .news-section-block p {
    margin: 0 0 40px 0;
    font-size: 19px;
    color: var(--news-text);
    line-height: 2.4;
    max-width: 100%;
  }
  .news-section-block p:last-child {
    margin-bottom: 0;
  }
  .news-section-block p br {
    display: block;
    content: "";
    margin-top: 12px;
  }
  .news-section-block .highlight-red {
    background: linear-gradient(180deg, transparent 60%, rgba(239, 68, 68, 0.35) 60%);
    padding: 3px 8px;
    font-weight: 700;
    font-size: 1.3em;
    color: #dc2626;
    border-radius: 3px;
    line-height: 1.4;
    display: inline-block;
  }
  .news-section-block .highlight-blue {
    background: linear-gradient(180deg, transparent 60%, rgba(59, 130, 246, 0.35) 60%);
    padding: 3px 8px;
    font-weight: 700;
    font-size: 1.3em;
    color: #2563eb;
    border-radius: 3px;
    line-height: 1.4;
    display: inline-block;
  }
  .news-section-block .highlight-yellow {
    background: linear-gradient(180deg, transparent 60%, rgba(250, 204, 21, 0.55) 60%);
    padding: 3px 8px;
    font-weight: 700;
    font-size: 1.3em;
    color: #ca8a04;
    border-radius: 3px;
    line-height: 1.4;
    display: inline-block;
  }
  .news-section-block .text-bold {
    font-weight: 700;
    font-size: 1.25em;
    color: #111827;
    line-height: 1.4;
  }
  .news-section-block .text-red {
    color: #dc2626;
    font-weight: 700;
    font-size: 1.25em;
    line-height: 1.4;
  }
  .news-section-block .text-blue {
    color: #2563eb;
    font-weight: 700;
    font-size: 1.25em;
    line-height: 1.4;
  }
  .news-list {
    margin: 16px 0 0;
    padding: 0;
    display: grid;
    gap: 14px;
    list-style: none;
  }
  .news-section-block .news-list li {
    padding: 16px 18px;
    background: rgba(244, 63, 94, 0.08);
    border-left: 4px solid var(--news-accent);
    border-radius: 18px;
    font-weight: 600;
  }
  .news-image-block {
    margin: 48px 0;
    text-align: center;
  }
  .news-image-block img {
    width: 100%;
    border-radius: calc(var(--news-radius) - 8px);
    box-shadow: 0 24px 50px rgba(15, 23, 42, 0.16);
  }
  .news-image-block figcaption {
    margin-top: 14px;
    font-size: 14px;
    color: var(--news-muted);
  }
  .news-callout {
    margin: 56px 0;
    padding: 36px 32px;
    border-radius: calc(var(--news-radius) - 6px);
    background: linear-gradient(120deg, rgba(244, 63, 94, 0.12), rgba(244, 63, 94, 0.04));
    border: 1px solid rgba(244, 63, 94, 0.16);
  }
  .news-callout h3 {
    margin-bottom: 16px;
    font-size: 24px;
    font-weight: 700;
    color: #9f1239;
  }
  .news-summary {
    margin-top: 64px;
    padding: 36px 32px;
    background: rgba(15, 23, 42, 0.03);
    border-radius: calc(var(--news-radius) - 6px);
    border: 1px solid rgba(15, 23, 42, 0.08);
  }
  .news-summary h3 {
    margin-bottom: 12px;
    font-size: 22px;
    font-weight: 700;
  }
  .news-summary p {
    margin: 0;
    color: var(--news-muted);
  }
  .news-info-block {
    margin: 0 auto 48px;
    max-width: 720px;
    padding: 28px 32px;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.05), rgba(15, 23, 42, 0.02));
    border-radius: calc(var(--news-radius) - 6px);
    border: 1px solid rgba(15, 23, 42, 0.1);
  }
  .news-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 24px;
  }
  .news-info-item {
    text-align: center;
  }
  .news-info-label {
    font-size: 13px;
    color: var(--news-muted);
    margin-bottom: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .news-info-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--news-text);
    margin-bottom: 4px;
  }
  .news-info-sub {
    font-size: 14px;
    color: var(--news-muted);
  }
  .news-info-weather-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  .news-kakao-share {
    margin-top: 64px;
    text-align: center;
  }
  .news-kakao-share-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 18px 32px;
    background-color: #FEE500;
    border: 2px solid #FDD835;
    border-radius: 16px;
    color: #3C1E1E;
    font-size: 18px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    min-width: 280px;
  }
  .news-kakao-share-button:hover {
    background-color: #FDD835;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  }
  .news-kakao-share-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .news-kakao-logo {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }
  .news-kakao-logo svg {
    width: 100%;
    height: 100%;
  }
  @media (max-width: 768px) {
    body {
      font-size: 17px;
    }
    .news-wrapper {
      padding: 40px 20px 96px;
      border-radius: 20px;
    }
    .news-section-block h2 {
      font-size: 26px;
    }
    .news-video-block {
      margin-bottom: 40px;
    }
    .news-kakao-share-button {
      padding: 16px 24px;
      font-size: 16px;
      min-width: 240px;
    }
    .news-kakao-logo {
      width: 24px;
      height: 24px;
    }
  }
`.trim();

export const DEFAULT_NEWS_TITLE = "크루즈 HQ 칼럼 제목을 입력하세요";
export const DEFAULT_NEWS_HIGHLIGHT =
  "독자에게 가장 먼저 전달하고 싶은 핵심 문장을 여기에 작성하세요.";

export const DEFAULT_NEWS_BLOCKS: NewsBlock[] = [
  {
    id: "intro-1",
    type: "intro",
    kicker: "[KEYWORD] HQ INSIGHT",
    lead: "이 서문 문장을 독자에게 전하고 싶은 핵심 메시지로 교체하세요. 2-3문장으로 구성하면 좋습니다.",
  },
  {
    id: "video-1",
    type: "video",
    url: "https://www.youtube.com/embed/QkC4Ymf7CR8?rel=0&mute=1&controls=1",
    caption: "영상 설명을 입력하세요. (예: 2025 크루즈닷 HQ 인사이드 리포트)",
    autoplay: false,
    mute: true,
  },
  {
    id: "section-1",
    type: "section",
    heading: "1. 첫 번째 소제목을 입력하세요",
    body: "첫 번째 본문 문단을 작성하세요. 데이터, 인용구, 현장 경험을 중심으로 4~6문장 분량을 권장합니다.",
    listItems: [
      "핵심 통계 혹은 인사이트를 bullet 형식으로 정리하세요.",
      "독자가 바로 실행할 수 있는 팁을 함께 제시하세요.",
      "필요하다면 불릿 개수를 자유롭게 조정하세요.",
    ],
  },
  {
    id: "section-2",
    type: "section",
    heading: "2. 두 번째 소제목을 입력하세요",
    body: "두 번째 본문 문단입니다. 비교, 사례, 고객 반응 등을 활용해 설득력을 높여 주세요. 중요 수치는 굵게 또는 형광펜 효과로 강조할 수 있습니다.",
    listItems: [],
  },
  {
    id: "callout-1",
    type: "callout",
    title: "CHECK POINT",
    body: "핵심 메시지를 2~3문장으로 요약한 콜아웃을 작성하세요. 셀링 포인트나 고객에게 꼭 알려야 할 사실을 넣으면 좋습니다.",
  },
  {
    id: "image-1",
    type: "image",
    src: "https://placehold.co/960x540/f43f5e/f8fafc?text=Cruisedot+Image",
    alt: "이미지 설명을 입력하세요",
    caption: "이미지에 대한 설명을 입력하세요. (예: 2025 크루즈 선박 내부)",
  },
  {
    id: "summary-1",
    type: "summary",
    title: "마무리 정리",
    body: "본문 핵심을 요약하고 다음 행동(Call to Action)으로 자연스럽게 이어 주세요. 예: '이번 주 HQ 세미나에서 자세히 안내드릴 예정입니다.'",
  },
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const renderBlockHtml = (block: NewsBlock) => {
  switch (block.type) {
    case "intro":
      return `
        <section class="news-intro">
          <div class="intro-kicker">${escapeHtml(block.kicker)}</div>
          <p class="intro-lead">${escapeHtml(block.lead)}</p>
        </section>
      `;
    case "video": {
      const url = escapeHtml(block.url);
      const caption = escapeHtml(block.caption);
      return `
        <section class="news-video-block">
          <div class="video-frame">
            <iframe
              src="${url}"
              title="Cruisedot HQ Video"
              loading="lazy"
              ${block.autoplay ? 'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"' : 'allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"'}
              ${block.mute ? 'data-muted="true"' : ""}
              allowfullscreen
            ></iframe>
          </div>
          <p class="media-caption">${caption}</p>
        </section>
      `;
    }
    case "section": {
      const listItems = block.listItems.filter((item) => item.trim().length > 0);
      const listMarkup =
        listItems.length > 0
          ? `
            <ul class="news-list">
              ${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          `
          : "";
      // 본문을 줄바꿈 기준으로 분리하여 각 문단을 <p> 태그로 감싸기 (2-3줄씩)
      // HTML 태그는 그대로 유지 (강조 효과를 위해)
      const paragraphs = block.body.split('\n').filter(p => p.trim().length > 0);
      const bodyMarkup = paragraphs.map(p => {
        const trimmed = p.trim();
        // HTML 태그가 포함된 경우 그대로 사용, 아니면 escape
        if (trimmed.includes('<span') || trimmed.includes('<strong') || trimmed.includes('<em')) {
          return `<p>${trimmed}</p>`;
        }
        return `<p>${escapeHtml(trimmed)}</p>`;
      }).join('');
      
      return `
        <article class="news-section-block">
          <h2>${escapeHtml(block.heading)}</h2>
          ${bodyMarkup || `<p>${escapeHtml(block.body)}</p>`}
          ${listMarkup}
        </article>
      `;
    }
    case "callout":
      return `
        <section class="news-callout">
          <h3>${escapeHtml(block.title)}</h3>
          <p>${escapeHtml(block.body)}</p>
        </section>
      `;
    case "image":
      return `
        <figure class="news-image-block">
          <img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" />
          <figcaption>${escapeHtml(block.caption)}</figcaption>
        </figure>
      `;
    case "summary":
      return `
        <section class="news-summary">
          <h3>${escapeHtml(block.title)}</h3>
          <p>${escapeHtml(block.body)}</p>
        </section>
      `;
    case "info": {
      const weatherHtml = block.weather
        ? `
          <div class="news-info-item">
            <div class="news-info-label">오늘의 날씨</div>
            <div class="news-info-weather-icon">${escapeHtml(block.weather.icon)}</div>
            <div class="news-info-value">${escapeHtml(String(block.weather.temp))}°C</div>
            <div class="news-info-sub">${escapeHtml(block.weather.description)}</div>
          </div>
        `
        : '';
      
      const exchangeHtml = block.exchangeRate
        ? `
          <div class="news-info-item">
            <div class="news-info-label">환율</div>
            <div class="news-info-value">USD ${escapeHtml(block.exchangeRate.usd.toLocaleString('ko-KR'))}</div>
            <div class="news-info-sub">EUR ${escapeHtml(block.exchangeRate.eur.toLocaleString('ko-KR'))} | JPY ${escapeHtml(block.exchangeRate.jpy.toFixed(2))}</div>
          </div>
        `
        : '';
      
      const stockHtml = block.stockMarket
        ? `
          <div class="news-info-item">
            <div class="news-info-label">증시</div>
            <div class="news-info-value">KOSPI ${escapeHtml(block.stockMarket.kospi.toLocaleString('ko-KR'))}</div>
            <div class="news-info-sub">KOSDAQ ${escapeHtml(block.stockMarket.kosdaq.toLocaleString('ko-KR'))} | NASDAQ ${escapeHtml(block.stockMarket.nasdaq.toLocaleString('ko-KR'))}</div>
          </div>
        `
        : '';
      
      if (!weatherHtml && !exchangeHtml && !stockHtml) {
        return '';
      }
      
      return `
        <section class="news-info-block">
          <div class="news-info-grid">
            ${weatherHtml}
            ${exchangeHtml}
            ${stockHtml}
          </div>
        </section>
      `;
    }
    default:
      return "";
  }
};

const getKakaoShareButton = (title: string) => {
  const shareTitle = escapeHtml(title);
  const shareDescription = '크루즈뉘우스에서 발행한 크루즈 여행 정보를 확인해보세요!';
  
  return `
    <div class="news-kakao-share">
      <button class="news-kakao-share-button" onclick="shareOnKakao()">
        <div class="news-kakao-logo">
          <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.73 0 3.36-.44 4.79-1.23l3.21 1.23-1.23-3.21c.79-1.43 1.23-3.06 1.23-4.79C22 6.48 17.52 2 12 2zm-1.25 12.01L8.98 14H7.5v-4h3.75l1.77-.99V14.01h-2.27z"/>
          </svg>
        </div>
        <span>카카오톡 친구에게 공유</span>
      </button>
    </div>
    <script>
      (function() {
        function shareOnKakao() {
          if (typeof window === 'undefined') return;
          
          if (!window.Kakao) {
            // 카카오톡 SDK 로드
            const script = document.createElement('script');
            script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
            script.async = true;
            script.onload = function() {
              initializeAndShare();
            };
            document.head.appendChild(script);
          } else {
            initializeAndShare();
          }
        }
        
        function initializeAndShare() {
          if (!window.Kakao) {
            alert('카카오톡 SDK가 로드되지 않았습니다.');
            return;
          }
          
          // 환경 변수에서 키 가져오기 (서버 사이드 렌더링 시에는 사용 불가)
          // 클라이언트에서만 동작하도록 설정
          if (!window.Kakao.isInitialized()) {
            // 페이지에서 카카오 키를 찾거나, 메타 태그에서 가져오기
            const kakaoKeyElement = document.querySelector('meta[name="kakao-js-key"]');
            const kakaoKey = kakaoKeyElement ? kakaoKeyElement.getAttribute('content') : null;
            
            if (kakaoKey) {
              window.Kakao.init(kakaoKey);
            } else {
              // 환경 변수가 없으면 공유 기능 비활성화
              alert('카카오톡 공유 기능을 사용할 수 없습니다. 관리자에게 문의해주세요.');
              return;
            }
          }
          
          const currentUrl = window.location.href;
          const shareTitle = '${shareTitle}';
          const shareDescription = '${shareDescription}';
          const imageUrl = window.location.origin + '/images/ai-cruise-logo.png';
          
          window.Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title: shareTitle,
              description: shareDescription,
              imageUrl: imageUrl,
              link: {
                mobileWebUrl: currentUrl,
                webUrl: currentUrl,
              },
            },
            buttons: [
              {
                title: '크루즈뉘우스 보기',
                link: {
                  mobileWebUrl: currentUrl,
                  webUrl: currentUrl,
                },
              },
            ],
          });
        }
        
        // 전역 함수로 등록
        window.shareOnKakao = shareOnKakao;
      })();
    </script>
  `;
};

export const buildNewsHtml = ({
  title,
  highlight,
  blocks,
}: {
  title: string;
  highlight: string;
  blocks: NewsBlock[];
}) => {
  const renderedBlocks = blocks.map((block) => renderBlockHtml(block)).join("\n");
  const safeHighlight = highlight.trim()
    ? `<div class="news-highlight">${escapeHtml(highlight.trim())}</div>`
    : "";
  const kakaoShareButton = getKakaoShareButton(title);

  return `
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
        <style>${NEWS_TEMPLATE_STYLE}</style>
      </head>
      <body>
        <div class="news-wrapper">
          <header class="news-header">
            <h1 class="news-title">${escapeHtml(title)}</h1>
          </header>
          ${safeHighlight}
          <main class="news-content">
            ${renderedBlocks}
          </main>
          ${kakaoShareButton}
        </div>
      </body>
    </html>
  `.trim();
};

