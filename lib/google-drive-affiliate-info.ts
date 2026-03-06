// lib/google-drive-affiliate-info.ts
// 어필리에이트 파일 업로드 유틸 (GMcruise 원본에서 분리됨 - stub)
// cruise-guide-app에서는 사용하지 않음

export async function uploadAffiliateInfoFile(
  _affiliateId: string | number,
  _fileBuffer: Buffer,
  _fileName: string,
  _mimeType?: string,
  _fileType?: string
): Promise<{ ok: boolean; url?: string; fileId?: string; error?: string }> {
  // cruise-guide-app에서는 어필리에이트 파일 업로드 미지원
  return { ok: false, error: 'Not supported in cruise-guide-app' };
}
