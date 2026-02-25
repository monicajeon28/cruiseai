/**
 * 성능 모니터링 유틸리티
 * API 호출 시간 및 페이지 로딩 시간 측정
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  type: 'api' | 'page' | 'query';
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 100; // 최대 저장 메트릭 수

  /**
   * API 호출 시간 측정
   */
  async measureApiCall<T>(
    name: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      this.recordMetric({
        name,
        duration,
        timestamp: Date.now(),
        type: 'api',
      });
      
      // 느린 API 호출 경고 (1초 이상)
      if (duration > 1000) {
        console.warn(`[Performance] Slow API call: ${name} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric({
        name,
        duration,
        timestamp: Date.now(),
        type: 'api',
      });
      throw error;
    }
  }

  /**
   * 페이지 로딩 시간 측정
   */
  measurePageLoad(pageName: string) {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      this.recordMetric({
        name: pageName,
        duration: loadTime,
        timestamp: Date.now(),
        type: 'page',
      });
    });
  }

  /**
   * 메트릭 기록
   */
  private recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // 최대 개수 초과 시 오래된 메트릭 제거
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // 개발 환경에서만 콘솔 출력
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${metric.type}: ${metric.name} - ${metric.duration.toFixed(2)}ms`);
    }
  }

  /**
   * 평균 응답 시간 계산
   */
  getAverageDuration(name: string, type?: PerformanceMetric['type']): number {
    const filtered = this.metrics.filter(
      m => m.name === name && (type ? m.type === type : true)
    );
    
    if (filtered.length === 0) return 0;
    
    const sum = filtered.reduce((acc, m) => acc + m.duration, 0);
    return sum / filtered.length;
  }

  /**
   * 최근 메트릭 조회
   */
  getRecentMetrics(limit: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  /**
   * 메트릭 초기화
   */
  clearMetrics() {
    this.metrics = [];
  }

  /**
   * 성능 리포트 생성
   */
  generateReport(): {
    apiCalls: { name: string; avgDuration: number; count: number }[];
    pageLoads: { name: string; avgDuration: number; count: number }[];
  } {
    const apiCalls = new Map<string, { total: number; count: number }>();
    const pageLoads = new Map<string, { total: number; count: number }>();

    this.metrics.forEach(metric => {
      if (metric.type === 'api') {
        const existing = apiCalls.get(metric.name) || { total: 0, count: 0 };
        apiCalls.set(metric.name, {
          total: existing.total + metric.duration,
          count: existing.count + 1,
        });
      } else if (metric.type === 'page') {
        const existing = pageLoads.get(metric.name) || { total: 0, count: 0 };
        pageLoads.set(metric.name, {
          total: existing.total + metric.duration,
          count: existing.count + 1,
        });
      }
    });

    return {
      apiCalls: Array.from(apiCalls.entries()).map(([name, data]) => ({
        name,
        avgDuration: data.total / data.count,
        count: data.count,
      })),
      pageLoads: Array.from(pageLoads.entries()).map(([name, data]) => ({
        name,
        avgDuration: data.total / data.count,
        count: data.count,
      })),
    };
  }
}

// 싱글톤 인스턴스
export const performanceMonitor = new PerformanceMonitor();

/**
 * API 호출 래퍼 (편의 함수)
 */
export async function measureApi<T>(
  name: string,
  apiCall: () => Promise<T>
): Promise<T> {
  return performanceMonitor.measureApiCall(name, apiCall);
}


