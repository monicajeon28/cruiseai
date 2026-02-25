// lib/tts.ts
// Text-to-Speech 유틸리티 (Web Speech API)

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
}

class TextToSpeech {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.loadSettings();
    }
  }

  /**
   * LocalStorage에서 TTS 설정 로드
   */
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('tts-enabled');
      this.isEnabled = saved !== 'false'; // 기본값은 true
    } catch (error) {
      console.warn('[TTS] Failed to load settings:', error);
    }
  }

  /**
   * TTS 활성화/비활성화 상태 가져오기
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * TTS 활성화/비활성화 설정
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('tts-enabled', String(enabled));
    } catch (error) {
      console.warn('[TTS] Failed to save settings:', error);
    }

    // 비활성화 시 현재 재생 중인 음성 중지
    if (!enabled) {
      this.stop();
    }
  }

  /**
   * 한국어 음성 가져오기
   */
  private async getKoreanVoice(): Promise<SpeechSynthesisVoice | undefined> {
    if (!this.synthesis) return undefined;

    return new Promise((resolve) => {
      const voices = this.synthesis!.getVoices();

      if (voices.length > 0) {
        // 한국어 음성 찾기 (우선순위: ko-KR)
        const koreanVoice = voices.find(v =>
          v.lang.startsWith('ko') || v.lang === 'ko-KR'
        );
        resolve(koreanVoice);
      } else {
        // 음성 목록이 아직 로드되지 않은 경우
        this.synthesis!.addEventListener('voiceschanged', () => {
          const voices = this.synthesis!.getVoices();
          const koreanVoice = voices.find(v =>
            v.lang.startsWith('ko') || v.lang === 'ko-KR'
          );
          resolve(koreanVoice);
        }, { once: true });
      }
    });
  }

  /**
   * 텍스트를 음성으로 읽기
   */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (!this.synthesis || !this.isEnabled) {
      console.log('[TTS] Speech synthesis not available or disabled');
      return;
    }

    // 현재 재생 중인 음성 중지
    this.stop();

    // 빈 텍스트 무시
    if (!text.trim()) {
      return;
    }

    // SpeechSynthesisUtterance 생성
    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;

    // 음성 설정
    utterance.rate = options.rate ?? 0.9; // 약간 느리게
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    // 한국어 음성 설정
    const koreanVoice = await this.getKoreanVoice();
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    // 이벤트 핸들러
    utterance.onend = () => {
      console.log('[TTS] Speech ended');
      this.currentUtterance = null;
    };

    utterance.onerror = (event) => {
      console.error('[TTS] Speech error:', event.error);
      this.currentUtterance = null;
    };

    // 음성 재생
    this.synthesis.speak(utterance);
  }

  /**
   * 현재 재생 중인 음성 중지
   */
  stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.currentUtterance = null;
    }
  }

  /**
   * 현재 음성이 재생 중인지 확인
   */
  isSpeaking(): boolean {
    return this.synthesis ? this.synthesis.speaking : false;
  }

  /**
   * 일시정지
   */
  pause(): void {
    if (this.synthesis) {
      this.synthesis.pause();
    }
  }

  /**
   * 재개
   */
  resume(): void {
    if (this.synthesis) {
      this.synthesis.resume();
    }
  }
}

// 글로벌 인스턴스
const tts = new TextToSpeech();

export default tts;

/**
 * 헬퍼 함수: AI 메시지에서 읽을 텍스트 추출
 * (마크다운, HTML 태그 등 제거)
 */
export function extractPlainText(text: string): string {
  let cleaned = text;

  // HTML 태그 제거
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // 마크다운 링크 제거 [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 마크다운 굵기/이탤릭 제거
  cleaned = cleaned.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');

  // 연속 공백 제거
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

