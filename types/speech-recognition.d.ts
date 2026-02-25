// types/speech-recognition.d.ts
// 중복 선언을 피하기 위해 SpeechRecognition 자체는 재선언하지 않습니다.
declare global {
  interface Window {
    // 크롬에서 쓰는 webkit 접두사 타입을 표준 SpeechRecognition과 연결
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
export {};



