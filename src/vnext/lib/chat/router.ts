import type { ChatInputMode } from '@/lib/types';
import type { ChatMessage, PhotoGalleryMessage, MapLinksMessage } from '@/lib/chat-types';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

import { makeUUID } from '@/vnext/lib/utils';
import { gmapDir, gmapSearch } from '@/vnext/lib/nav/urls';
import { handleNearby } from './nearby/handler';
import { handleTaiwanNav } from './taiwanNav';

export type Intent = 'directions' | 'nearby' | 'photos' | 'taiwan-nav' | 'free' | 'unknown';

interface IntentDetectionResult {
  intent: Intent;
  keyword?: string; // 'nearby' 또는 'photos'에서 사용
  origin?: string;  // 'directions'에서 사용
  destination?: string; // 'directions'에서 사용
}

function detectIntent(text: string, mode: ChatInputMode): IntentDetectionResult {
  const lowerText = text.toLowerCase();

  if (mode === 'go') {
    if (lowerText.includes('타이완') || lowerText.includes('대만') || lowerText.includes('타이베이') || lowerText.includes('지룽')) {
      return { intent: 'taiwan-nav' };
    }
    if (lowerText.includes('길찾기') || lowerText.includes('어떻게 가') || lowerText.includes('가는 길') || lowerText.includes('위치') || lowerText.includes('좌표')) {
      // 기본적인 길찾기 키워드 (출발지, 목적지 포함 여부는 핸들러에서 분석)
      const originMatch = lowerText.match(/(?:에서|출발지\s*[:]?\s*)(.*?)(?:까지|도착지\s*[:]?\s*)(.*)/);
      const destMatch = lowerText.match(/(?:까지|도착지\s*[:]?\s*)(.*)/);
      if (originMatch && originMatch[1] && originMatch[2]) {
        return { intent: 'directions', origin: originMatch[1], destination: originMatch[2] };
      } else if (destMatch && destMatch[1]) {
        return { intent: 'directions', destination: destMatch[1] };
      }
      return { intent: 'directions', keyword: text }; // 키워드 전체를 넘겨서 핸들러에서 파싱
    }
    if (lowerText.includes('근처') || lowerText.includes('주변') || lowerText.includes('가까운')) {
      const keywordMatch = lowerText.match(/(근처|주변|가까운)\s*(.*?)(찾아줘|어딨어|어디야)/);
      return { intent: 'nearby', keyword: keywordMatch ? keywordMatch[2].trim() : '' };
    }
  }

  if (mode === 'show') {
    if (lowerText.includes('사진') || lowerText.includes('이미지') || lowerText.includes('보여줘') || lowerText.includes('앨범')) {
      const keywordMatch = lowerText.match(/(.*?)(사진|이미지|보여줘|앨범)/);
      return { intent: 'photos', keyword: keywordMatch ? keywordMatch[1].trim() : '' };
    }
  }

  // 일반 모드 또는 특정 인텐트 감지 실패 시
  if (mode === 'general') {
    return { intent: 'free', keyword: text };
  }

  return { intent: 'unknown', keyword: text };
}

// API 라우터 함수 (Next.js Edge Runtime에 맞게 수정)
export async function chatRouter(text: string, mode: ChatInputMode): Promise<ChatMessage[]> {
  const user = await getSessionUser();
  if (!user) {
    return [{ id: makeUUID(), role: 'assistant', type: 'text', text: '로그인이 필요합니다.' }];
  }

  const detection = detectIntent(text, mode);
  const responseMessages: ChatMessage[] = [];

  switch (detection.intent) {
    case 'taiwan-nav':
      responseMessages.push(...(await handleTaiwanNav(text)));
      break;

    case 'directions': {
      let originText = detection.origin || '';
      let destText = detection.destination || '';

      // '크루즈 터미널' 관련 질문인 경우 terminals.ts 핸들러를 먼저 시도 (여기서는 일반 길찾기로 통합)
      if ((destText.includes('터미널') || destText.includes('크루즈')) && !originText) { // 목적지가 터미널인데 출발지가 없으면 현재 위치 가정
        responseMessages.push({
          id: makeUUID(), // id 추가
          role: 'assistant', // role 추가
          type: 'text',
          text: `현재 위치에서 ${destText}까지 길찾기 정보를 찾고 있어요!`
        });
        responseMessages.push({
          id: makeUUID(), // id 추가
          role: 'assistant', // role 추가
          type: 'map-links',
          title: '다양한 이동 수단',
          links: [
            { label: '🚌 대중교통', href: gmapDir('현재 위치', destText, 'transit'), kind: 'directions' },
            { label: '🚗 자동차', href: gmapDir('현재 위치', destText, 'driving'), kind: 'directions' },
          ],
        } as MapLinksMessage);
      } else if (originText && destText) {
        // 일반적인 길찾기
        responseMessages.push({
          id: makeUUID(), // id 추가
          role: 'assistant', // role 추가
          type: 'text',
          text: `🧭 ${originText}에서 ${destText}까지 길찾기 정보를 찾았어요!`
        });
        responseMessages.push({
          id: makeUUID(), // id 추가
          role: 'assistant', // role 추가
          type: 'map-links',
          title: '다양한 이동 수단',
          links: [
            { label: '🚌 대중교통', href: gmapDir(originText, destText, 'transit'), kind: 'directions' },
            { label: '🚗 자동차', href: gmapDir(originText, destText, 'driving'), kind: 'directions' },
          ],
        } as MapLinksMessage);
        responseMessages.push({
          id: makeUUID(), // id 추가
          role: 'assistant', // role 추가
          type: 'text',
          text: '실시간 소요시간·영업시간은 링크에서 자동 갱신됩니다.'
        });
      } else if (destText) {
        // 목적지만 있는 경우 (예: "미국 크루즈 터미널 어떻게 가?")
        responseMessages.push({
          id: makeUUID(), // id 추가
          role: 'assistant', // role 추가
          type: 'text',
          text: `어디에서 ${destText}로 가실 예정이신가요? 출발지를 알려주시면 더 정확한 길찾기를 도와드릴 수 있어요.`
        });
        responseMessages.push({
          id: makeUUID(), // id 추가
          role: 'assistant', // role 추가
          type: 'map-links',
          title: '바로 검색',
          links: [
            { label: `🗺️ ${destText} 검색`, href: gmapSearch(destText), kind: 'poi' },
          ],
        } as MapLinksMessage);
        responseMessages.push({
          id: makeUUID(), // id 추가
          role: 'assistant', // role 추가
          type: 'text',
          text: '실시간 소요시간·영업시간은 링크에서 자동 갱신됩니다.'
        });
      } else {
        responseMessages.push({
          id: makeUUID(), // id 추가
          role: 'assistant', // role 추가
          type: 'text',
          text: '출발지와 목적지를 정확히 알려주시면 길찾기를 도와드릴게요. (예: 인천공항에서 포트미애미 터미널까지)'
        });
      }
      break;
    }

    case 'nearby':
      responseMessages.push(...(await handleNearby(text, detection.keyword || '')));
      break;

    case 'photos':
      // handleShowPhotos 로직이 필요하지만, 현재는 더미 응답
      responseMessages.push({
        id: makeUUID(),
        role: 'assistant',
        type: 'text',
        text: `\`${detection.keyword || text}\` 에 대한 사진을 찾고 있어요! (아직 구현되지 않음)`
      });
      break;

    case 'free':
    default:
      responseMessages.push({
        id: makeUUID(),
        role: 'assistant',
        type: 'text',
        text: `요청하신 "${text}"에 대해 준비 중이에요. 더 자세히 알려주시면 바로 안내할게요. 😊`
      });
      break;
  }

  return responseMessages;
}
