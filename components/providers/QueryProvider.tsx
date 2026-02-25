'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000, // 5분 - 캐시된 데이터 재사용
                        gcTime: 10 * 60 * 1000, // 10분 - 가비지 컬렉션 시간
                        refetchOnWindowFocus: false,
                        refetchOnMount: false, // 마운트 시 자동 재요청 비활성화
                        refetchOnReconnect: false, // 재연결 시 자동 재요청 비활성화
                        retry: 1, // 재시도 1회로 제한 (기본값 3회)
                        retryDelay: 1000, // 재시도 간격 1초
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
