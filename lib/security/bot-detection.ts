/**
 * 봇 및 스크래퍼 탐지 유틸리티
 * User-Agent 기반 봇 차단 및 의심스러운 요청 탐지
 */

// 알려진 봇 User-Agent 패턴
const BOT_PATTERNS = [
  // 검색 엔진 봇 (허용)
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /sogou/i,
  /exabot/i,
  /facebot/i,
  /ia_archiver/i,
  
  // 스크래퍼 및 악성 봇 (차단)
  /scraper/i,
  /crawler/i,
  /spider/i,
  /bot/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /python-urllib/i,
  /java/i,
  /go-http-client/i,
  /node-fetch/i,
  /axios/i,
  /postman/i,
  /insomnia/i,
  /httpie/i,
  /rest-client/i,
  /apache-httpclient/i,
  /okhttp/i,
  /scrapy/i,
  /beautifulsoup/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /headless/i,
  /phantomjs/i,
  /casperjs/i,
  /nightmare/i,
  /webdriver/i,
  /chromedriver/i,
  /geckodriver/i,
];

// 허용된 검색 엔진 봇
const ALLOWED_BOTS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /sogou/i,
  /exabot/i,
  /facebot/i,
  /ia_archiver/i,
];

/**
 * User-Agent가 봇인지 확인
 * @param userAgent User-Agent 문자열
 * @returns true if bot, false otherwise
 */
export function isBot(userAgent: string | null | undefined): boolean {
  // User-Agent가 없거나 비어있으면 일반 브라우저로 간주 (통과)
  if (!userAgent || userAgent.trim() === '') {
    return false;
  }
  
  const ua = userAgent.toLowerCase();
  
  // 일반 브라우저 User-Agent 패턴 (통과)
  const browserPatterns = [
    /mozilla/i,
    /chrome/i,
    /safari/i,
    /firefox/i,
    /edge/i,
    /opera/i,
    /msie/i,
    /trident/i,
  ];
  
  // 일반 브라우저로 보이면 통과
  if (browserPatterns.some(pattern => pattern.test(ua)) && !/bot|crawler|spider|scraper/i.test(ua)) {
    return false;
  }
  
  // 허용된 검색 엔진 봇은 통과
  if (ALLOWED_BOTS.some(pattern => pattern.test(ua))) {
    return false;
  }
  
  // 차단할 봇 패턴 확인 (명확한 봇만 차단)
  return BOT_PATTERNS.some(pattern => pattern.test(ua));
}

/**
 * 의심스러운 요청인지 확인
 * @param userAgent User-Agent 문자열
 * @param headers 요청 헤더
 * @returns true if suspicious, false otherwise
 */
export function isSuspiciousRequest(
  userAgent: string | null | undefined,
  headers: Headers | Record<string, string | string[] | undefined>
): boolean {
  // User-Agent가 없거나 비어있으면 일반 요청으로 간주 (통과)
  if (!userAgent || userAgent.trim() === '') {
    return false;
  }
  
  // 일반적인 브라우저 헤더가 없어도 의심스럽지 않게 처리 (완화)
  const accept = headers['accept'] || headers['Accept'];
  const acceptLanguage = headers['accept-language'] || headers['Accept-Language'];
  const acceptEncoding = headers['accept-encoding'] || headers['Accept-Encoding'];
  
  // Accept 헤더가 없어도 통과 (API 요청은 Accept가 다를 수 있음)
  // Accept 헤더가 있지만 비정상적인 경우만 의심스럽게 처리
  if (accept && typeof accept === 'string') {
    const acceptStr = accept.toLowerCase();
    // 완전히 비정상적인 Accept만 차단
    if (!acceptStr.includes('*') && 
        !acceptStr.includes('text') && 
        !acceptStr.includes('application') && 
        !acceptStr.includes('image') &&
        !acceptStr.includes('json')) {
      return true;
    }
  }
  
  // Accept-Language가 없어도 통과 (완화)
  // 완전히 명확한 스크래퍼만 차단하도록 완화
  
  return false;
}

// 모듈 레벨에서 한 번만 컴파일 (매 요청마다 배열 생성/순회 오버헤드 제거)
const SCRAPER_REGEX = /curl|wget|python-requests|python-urllib|scrapy|beautifulsoup|selenium|puppeteer|playwright|headless|phantomjs|casperjs|nightmare|webdriver|chromedriver|geckodriver|postman|insomnia|httpie|rest-client/i;

/**
 * 스크래퍼 도구인지 확인
 * @param userAgent User-Agent 문자열
 * @returns true if scraper tool, false otherwise
 */
export function isScraperTool(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === '') {
    return false;
  }
  return SCRAPER_REGEX.test(userAgent);
}


