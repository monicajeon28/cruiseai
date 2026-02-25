import type { TextMessage } from "@/lib/chat-types";
import { buildSearchUrl } from "@/lib/maps";
import { resolveTerminal } from "@/lib/resolve";
import { parseSingleDestNav } from "@/lib/parsers";

// msg 헬퍼 제거

export async function tryHandleTerminalLocation(text: string): Promise<TextMessage | null> {
  const placeQuery = parseSingleDestNav(text);
  console.log("[handler/location] parseSinglePlaceQuery:", placeQuery);

  if (placeQuery) {
    const terminal = resolveTerminal(placeQuery.destination);

    if (!terminal) {
      return {
        id: Math.random().toString(),
        role: "assistant",
        type: "text",
        text: `'${placeQuery.destination}'에 대한 정보를 찾을 수 없어요.`,
        chips: [{
          label: `🗺️ ${placeQuery.destination} 지도 보기`,
          payload: buildSearchUrl(placeQuery.destination),
        }],
      };
    }

    if (!terminal.lat || !terminal.lon) {
      return {
        id: Math.random().toString(),
        role: "assistant",
        type: "text",
        text: `정확한 위치 정보를 찾을 수 없어서 일반 검색 링크를 제공합니다.`,
        chips: [{
          label: `🗺️ ${terminal.name} 지도 보기`,
          payload: buildSearchUrl(terminal.name),
        }],
      };
    }

    const gmapsUrl = buildSearchUrl(terminal.name);
    return {
      id: Math.random().toString(),
      role: "assistant",
      type: "text",
      text: `'${placeQuery.destination}'의 위치입니다.`,
      chips: [{ label: '🗺️ 지도 보기', payload: gmapsUrl }],
    };
  }

  return null;
} 