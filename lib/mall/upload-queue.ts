// lib/upload-queue.ts
// 파일 업로드 큐 (비용 0원)
// 동시 업로드를 제한하여 메모리 사용량 감소 및 서버 안정성 향상

import { logger } from '../logger';

interface QueuedUpload {
  uploadFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

class UploadQueue {
  private queue: QueuedUpload[] = [];
  private processing = false;
  private maxConcurrent = 3; // 동시에 최대 3개만 처리
  private currentCount = 0;

  /**
   * 업로드 요청을 큐에 추가
   */
  async add<T>(uploadFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ uploadFn, resolve, reject });
      this.process();
    });
  }

  /**
   * 큐에서 업로드 처리
   */
  private async process() {
    // 이미 처리 중이거나 동시 처리 수가 최대치에 도달한 경우
    if (this.processing || this.currentCount >= this.maxConcurrent) {
      return;
    }

    // 큐가 비어있으면 종료
    if (this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const item = this.queue.shift();

    if (!item) {
      this.processing = false;
      return;
    }

    this.currentCount++;

    try {
      const result = await item.uploadFn();
      item.resolve(result);
    } catch (error) {
      logger.error('[Upload Queue] 업로드 실패:', error);
      item.reject(error);
    } finally {
      this.currentCount--;
      this.processing = false;

      // 다음 업로드 처리 (약간의 지연을 두어 서버 부하 분산)
      if (this.queue.length > 0) {
        setTimeout(() => this.process(), 100);
      }
    }
  }

  /**
   * 큐 상태 조회
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      currentCount: this.currentCount,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

export const uploadQueue = new UploadQueue();
