/**
 * 가상 배경 처리 유틸리티
 * Canvas API를 사용하여 배경 블러 및 이미지 교체
 */

export interface VirtualBackgroundOptions {
  type: 'none' | 'blur' | 'image';
  blurIntensity?: number; // 0-100
  backgroundImage?: string; // 이미지 URL
}

export class VirtualBackgroundProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private video: HTMLVideoElement | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  private animationFrameId: number | null = null;
  private options: VirtualBackgroundOptions = { type: 'none' };
  private isProcessing = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }
    this.ctx = context;
  }

  async setVideo(video: HTMLVideoElement) {
    this.video = video;
    this.canvas.width = video.videoWidth || 640;
    this.canvas.height = video.videoHeight || 480;
  }

  async setBackgroundImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.backgroundImage = img;
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  setOptions(options: VirtualBackgroundOptions) {
    this.options = options;
    
    if (options.type === 'image' && options.backgroundImage) {
      this.setBackgroundImage(options.backgroundImage);
    }
  }

  // 간단한 배경 분리 (색상 기반, 실제로는 ML 모델 필요)
  private isBackgroundPixel(x: number, y: number, imageData: ImageData): boolean {
    const index = (y * imageData.width + x) * 4;
    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];
    
    // 녹색 스크린 효과 (간단한 예시)
    // 실제로는 MediaPipe Selfie Segmentation 같은 ML 모델 사용 권장
    const greenThreshold = 100;
    return g > greenThreshold && g > r && g > b;
  }

  // 배경 블러 처리
  private applyBlur(imageData: ImageData, intensity: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    const radius = Math.floor(intensity / 10); // 0-10 범위로 변환
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              a += data[idx + 3];
              count++;
            }
          }
        }
        
        const idx = (y * width + x) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
        data[idx + 3] = a / count;
      }
    }
    
    return new ImageData(data, width, height);
  }

  private processFrame() {
    if (!this.video || !this.isProcessing) return;
    
    const { videoWidth, videoHeight } = this.video;
    if (videoWidth === 0 || videoHeight === 0) {
      this.animationFrameId = requestAnimationFrame(() => this.processFrame());
      return;
    }

    // Canvas 크기 조정
    if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
    }

    // 비디오 프레임 그리기
    this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);

    if (this.options.type === 'none') {
      // 배경 처리 없음
      this.animationFrameId = requestAnimationFrame(() => this.processFrame());
      return;
    }

    // 이미지 데이터 가져오기
    const imageData = this.ctx.getImageData(0, 0, videoWidth, videoHeight);

    if (this.options.type === 'blur') {
      // 배경 블러 적용 (간단한 구현)
      const blurIntensity = this.options.blurIntensity || 50;
      const blurred = this.applyBlur(imageData, blurIntensity);
      this.ctx.putImageData(blurred, 0, 0);
    } else if (this.options.type === 'image' && this.backgroundImage) {
      // 배경 이미지 교체
      // 실제로는 ML 모델을 사용하여 사람을 분리해야 함
      // 여기서는 간단한 예시로 전체 이미지를 배경으로 사용
      this.ctx.save();
      
      // 배경 이미지 그리기 (캔버스 크기에 맞게)
      const scale = Math.max(
        videoWidth / this.backgroundImage.width,
        videoHeight / this.backgroundImage.height
      );
      const scaledWidth = this.backgroundImage.width * scale;
      const scaledHeight = this.backgroundImage.height * scale;
      const x = (videoWidth - scaledWidth) / 2;
      const y = (videoHeight - scaledHeight) / 2;
      
      this.ctx.drawImage(
        this.backgroundImage,
        x, y, scaledWidth, scaledHeight
      );
      
      // 원본 비디오를 위에 그리기 (알파 블렌딩)
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);
      
      this.ctx.restore();
    }

    this.animationFrameId = requestAnimationFrame(() => this.processFrame());
  }

  start() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processFrame();
  }

  stop() {
    this.isProcessing = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  getProcessedStream(): MediaStream | null {
    if (!this.canvas) return null;
    return this.canvas.captureStream(30); // 30fps
  }

  dispose() {
    this.stop();
    this.video = null;
    this.backgroundImage = null;
  }
}







