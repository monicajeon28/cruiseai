export async function resolveMedia(query: string, limit = 12): Promise<{
  title: string;
  images: { url: string; title?: string }[];
  chips?: { label: string; payload?: string }[];
}> {
  // 여기에 네 실제 구현을 연결. 일단 더미 리턴으로 컴파일만 통과:
  return {
    title: `${query} 사진`,
    images: [],
    chips: []
  };
}


