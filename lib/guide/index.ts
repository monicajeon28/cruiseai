// lib/guide/index.ts
// 크루즈가이드 서비스 전용 배럴 exports
// 사용법: import { askGemini } from '@/lib/guide'
//
// 포함: AI/챗봇, 지도/위치, 날씨, 여행 유틸, TTS, 크루즈 데이터
// 주의: 기존 import 경로('@/lib/gemini' 등)는 그대로 유지됩니다.
// 주의: Place 타입은 여러 파일에 존재 → GeoPlace/GeoDbPlace/MapsPlace/NavdataPlace 로 구분

// ============================================================================
// AI / 번역 (Gemini)
// ============================================================================
export { askGemini, scanPassport } from '../gemini';
export {
  resolveGeminiModelName,
  getDefaultGeminiModel,
  getChatModelName,
} from '../ai/geminiModel';
export { generateEmbedding, normalizeVector } from '../ai/embeddingUtils';
export { searchKnowledgeBase, searchKnowledgeBaseByKeywords } from '../ai/ragSearch';
export type { SearchResult } from '../ai/ragSearch';

// ============================================================================
// TTS (Text-to-Speech)
// ============================================================================
export { default as tts, extractPlainText } from './tts';
export type { TTSOptions } from './tts';

// ============================================================================
// 채팅봇
// ============================================================================
export type {
  Button,
  TextMessage,
  MapLinksMessage,
  PhotosMessage,
  PhotoGalleryMessage,
  GoActionsMessage,
  ShowMeMessage,
  ChatMessage,
} from '../chat-types';

export { detectShowMeIntent, extractShowMeQuery, googleImageSearch } from '../chat/detect';
export { detectIntent, extractSlots } from '../chat/intent';
export type { Intent, Slots } from '../chat/intent';
export { routeByText } from '../chat/router';
export type { BlockId } from '../chat/router';
export { resolveNavQuery } from '../chat/resolveNav';
export type { NavAPIResult } from '../chat/resolveNav';
export { taiwanAirports } from '../chat/airports';
export type { Airport } from '../chat/airports';

export {
  PURCHASE_CHATBOT_VIDEOS,
  pickVideoByContext,
  pickVideoByOrder,
  pickVideoByQuestionText,
} from '../chat-bot/media';
export type { ChatBotVideoEntry } from '../chat-bot/media';
export { normalizeQuestionNavigation } from '../chat-bot/question-utils';

// ============================================================================
// 지도 / 위치 (Place 타입 충돌 → 별칭 처리)
// ============================================================================

// lib/geo.ts — 구글맵 URL 생성 및 장소 파싱
export {
  gmapsSearch,
  gmapsDir,
  resolveFromTo as geoResolveFromTo,
  resolvePlace,
  suggestTerminalsByCountry,
  hongKongCruiseCandidates,
  originPlaceFor,
} from '../geo';
export type { NavMode, Place as GeoPlace } from '../geo';

// lib/geo-db.ts — 터미널 DB 검색
export { findTerminalCandidates, resolveAliasOrPlace } from '../geo-db';
export type { Place as GeoDbPlace } from '../geo-db';

// lib/geo/aliases.ts — 국가·도시 한글↔영문
export { COUNTRY_KO_TO_EN, CITY_KO_TO_EN } from '../geo/aliases';

// lib/maps.ts — 구글맵 URL 빌더
export {
  gmDirUrl,
  gmSearchUrl,
  resolveFromTo,
  buildAllDirUrls,
  buildDirectionsUrl,
  buildSearchUrl,
} from '../maps';
export type { Place as MapsPlace, LatLng } from '../maps';

// ============================================================================
// 내비게이션 (lib/nav.ts — 실제 파일)
// ============================================================================
export {
  gmapDir,
  gmapPlace,
  gmapNearby,
  buildNavHTML,
  buildNearbyHTML,
  parseAB,
} from '../nav';
export type { XY } from '../nav';

// ============================================================================
// 터미널 / 공항 데이터 (lib/navdata.ts)
// ============================================================================
export {
  airportsByCountry,
  terminalsByRegion,
  findAirportsByToken,
  findCruiseTerminalsByToken,
  normalizePlace,
} from '../navdata';
export type { Place as NavdataPlace } from '../navdata';

// ============================================================================
// 내비게이션 서브 유틸 (lib/nav/ 폴더)
// ============================================================================
export { normalizeCountry } from '../nav/country';
export { countryMap } from '../nav/countryMap';
export { detectRegionCode } from '../nav/geo';
export { buildTokens } from '../nav/poiTokens';
export type { POI } from '../nav/poiTokens';
export {
  isAirport,
  isCruise,
  resolveCountryFromText,
  findOrigins,
  findDestinations,
} from '../nav/selector';
export { gmapsDir as navGmapsDir, gmapsNearby } from '../nav/urls';

// ============================================================================
// 기항지 데이터
// ============================================================================
export * from '../terminals';

// ============================================================================
// 날씨
// ============================================================================
export { getWeatherForecast, getCurrentWeather } from './weather';
export type { WeatherForecast, WeatherResponse } from './weather';

// ============================================================================
// 크루즈 데이터
// ============================================================================
export {
  getAllCruiseLines,
  getShipsByCruiseLine,
  getAllShipNames,
  searchCruiseLines,
  searchShipNames,
  searchCruiseLinesAndShips,
} from '../cruise-data';
export { CRUISE_CATEGORIES, findRelevantCategories } from '../cruise-categories';
export type { CruiseCategory } from '../cruise-categories';
export * from '../cruise-images';

// ============================================================================
// 날짜 유틸 (formatDate 충돌 → 별칭 처리)
// ============================================================================

// lib/date.ts — ISO/기본 날짜 처리
export {
  parseISO,
  toISO,
  safeDate,
  fmt,
  formatDate as formatISODate,
  diffDays,
  dd,
  todayISO,
  dDiff,
} from '../date';

// lib/date-utils.ts — D-Day 메시지
export * from '../date-utils';

// lib/days.ts — 날짜 차이(일 수)
export { dday } from '../days';

// lib/dday.ts — server-only: Server Component / API Route 전용
export { getDdayMessage as getDdayMessageServer } from './dday';
export type { DdayParams } from './dday';

// ============================================================================
// 여행 유틸
// ============================================================================
export {
  formatDate as formatTripDate,
  cleanupDestination,
  getNightsDays,
  getDDay,
  resolveDdayKey,
} from '../trip-utils';

// ============================================================================
// 여권 유틸
// ============================================================================
export { backupPassportDataToUser, findUserByNameAndPhone } from '../passport-utils';

// ============================================================================
// UX 유틸
// ============================================================================
export {
  triggerHaptic,
  hapticClick,
  hapticImpact,
  hapticSuccess,
  hapticError,
  hapticWarning,
} from './haptic';
export type { HapticType } from './haptic';

export { useKeyboardHandler, setViewportHeight, useViewportHeight } from './keyboard-handler';
export { resolveMedia } from '../media';

// ============================================================================
// 이미지 유틸
// ============================================================================
export { getShimmerDataURL, getGrayBlurDataURL } from '../image-utils';
export { pickMessageImage } from '../images';

// ============================================================================
// 공통 유틸
// ============================================================================
export * from '../utils/countryMapping';
export * from '../utils/cruiseNames';
export * from '../utils/itineraryPattern';
export * from '../utils/pagination';
export * from '../utils/url-safety';

// ============================================================================
// SEO (가이드 사이트)
// ============================================================================
export * from '../seo/metadata';
export * from '../seo/structured-data';
