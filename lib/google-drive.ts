import { google } from 'googleapis';
import { Readable } from 'stream';

type UploadParams = {
  folderId?: string | null;
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
  makePublic?: boolean;
};

type UploadResult = {
  ok: boolean;
  fileId?: string;
  url?: string;
  error?: string;
};

type FindOrCreateFolderResult = {
  ok: boolean;
  folderId?: string;
  error?: string;
};

/**
 * Google Auth 클라이언트 생성 (공통 인증 로직)
 * Private Key 형식을 자동으로 보정하여 인증 객체를 반환합니다.
 */
export function getGoogleAuth(scopes?: string[]) {
  // 1. 환경변수에서 Private Key 찾기 (여러 이름 모두 확인)
  const rawPrivateKey =
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.PRIVATE_KEY;

  if (!rawPrivateKey) {
    console.error('[GoogleAuth] Private Key가 환경변수에 없습니다.');
    throw new Error('Google Service Account Private Key 설정 오류');
  }

  // 2. 환경변수에서 Client Email 찾기 (여러 이름 모두 확인)
  const clientEmail =
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    process.env.CLIENT_EMAIL;

  if (!clientEmail) {
    console.error('[GoogleAuth] Client Email이 환경변수에 없습니다.');
    throw new Error('Google Service Account Client Email 설정 오류');
  }

  // 3. 줄바꿈 문자 처리 및 형식 정규화
  let privateKey = rawPrivateKey.trim();

  // 따옴표로 감싸져 있다면 제거 (또는 JSON 문자열일 경우 파싱)
  if (privateKey.startsWith('"') || privateKey.startsWith("'")) {
    try {
      // JSON 문자열로 파싱 시도 (이중 이스케이프 처리 등)
      privateKey = JSON.parse(privateKey);
    } catch (e) {
      // 파싱 실패 시 단순 따옴표 제거
      privateKey = privateKey.replace(/^["']+|["']+$/g, '');
    }
  }

  // 이스케이프된 줄바꿈 문자를 실제 줄바꿈으로 변환
  privateKey = privateKey.replace(/\\n/g, '\n');

  // 4. BEGIN/END 라인 확인
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    console.error('[GoogleAuth] Private key 형식 오류: BEGIN PRIVATE KEY 라인이 없습니다.');
    throw new Error('Private key 형식이 올바르지 않습니다. -----BEGIN PRIVATE KEY-----로 시작해야 합니다.');
  }

  if (!privateKey.includes('-----END PRIVATE KEY-----')) {
    console.error('[GoogleAuth] Private key 형식 오류: END PRIVATE KEY 라인이 없습니다.');
    throw new Error('Private key 형식이 올바르지 않습니다. -----END PRIVATE KEY-----로 끝나야 합니다.');
  }

  // 5. Google Auth 생성
  try {
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: scopes || [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets'
      ],
    });
  } catch (authError: any) {
    console.error('[GoogleAuth] GoogleAuth 생성 실패:', authError);
    throw authError;
  }
}

export function getDriveClient() {
  try {
    const auth = getGoogleAuth();
    return google.drive({ version: 'v3', auth });
  } catch (error: any) {
    throw error;
  }
}

export async function findOrCreateFolder(
  folderName: string,
  parentFolderId?: string | null
): Promise<FindOrCreateFolderResult> {
  try {
    const drive = getDriveClient();
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    // 먼저 기존 폴더 검색
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    if (parentFolderId && parentFolderId !== 'root') {
      query += ` and '${parentFolderId}' in parents`;
    } else if (sharedDriveId && sharedDriveId !== 'root') {
      query += ` and '${sharedDriveId}' in parents`;
    }

    const searchOptions: any = {
      q: query,
      fields: 'files(id, name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      searchOptions.corpora = 'allDrives';
    }

    const searchResponse = await drive.files.list(searchOptions);

    // 기존 폴더가 있으면 반환
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folderId = searchResponse.data.files[0].id;
      if (folderId) {
        return { ok: true, folderId };
      }
    }

    // 폴더가 없으면 생성
    const createBody: Record<string, any> = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentFolderId && parentFolderId !== 'root') {
      createBody.parents = [parentFolderId];
    } else if (sharedDriveId && sharedDriveId !== 'root') {
      createBody.parents = [sharedDriveId];
    }

    const createOptions: any = {
      requestBody: createBody,
      fields: 'id, name',
      supportsAllDrives: true,
    };

    const createResponse = await drive.files.create(createOptions);
    const folderId = createResponse.data.id;

    if (!folderId) {
      throw new Error('폴더 생성에 실패했습니다 (folderId 없음).');
    }

    return { ok: true, folderId };
  } catch (error: any) {
    console.error('[GoogleDrive] findOrCreateFolder error:', error);
    return { ok: false, error: error?.message || '폴더 찾기/생성 실패' };
  }
}

/**
 * Google Drive 폴더 내 파일 목록 가져오기
 */
export async function listFilesInFolder(
  folderId: string,
  subfolderPath?: string
): Promise<{ ok: boolean; files?: Array<{ name: string; url: string; mimeType: string; id: string }>; error?: string }> {
  try {
    const drive = getDriveClient();

    // 서브폴더 경로가 있으면 해당 폴더 찾기
    let targetFolderId = folderId;
    if (subfolderPath) {
      const pathParts = subfolderPath.split('/').filter(Boolean);
      for (const part of pathParts) {
        const result = await findOrCreateFolder(part, targetFolderId);
        if (result.ok && result.folderId) {
          targetFolderId = result.folderId;
        } else {
          return { ok: false, error: `서브폴더를 찾을 수 없습니다: ${part}` };
        }
      }
    }

    // Shared Drive 사용 여부 확인
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    // 폴더 내 파일 목록 가져오기
    const listOptions: any = {
      q: `'${targetFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, size, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 1000,
    };

    // Shared Drive 사용 시 옵션 추가
    if (sharedDriveId && sharedDriveId !== 'root') {
      listOptions.supportsAllDrives = true;
      listOptions.includeItemsFromAllDrives = true;
      listOptions.corpora = 'allDrives';
    }

    const response = await drive.files.list(listOptions);

    const files = (response.data.files || []).map(file => {
      const fileId = file.id || '';
      const mimeType = file.mimeType || '';
      const isImage = mimeType.startsWith('image/');

      return {
        name: file.name || '',
        url: getDriveFileUrl(fileId, isImage),
        mimeType,
        id: fileId,
        size: parseInt(file.size || '0', 10),
        modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
      };
    });

    return { ok: true, files };
  } catch (error: any) {
    console.error('[GoogleDrive] listFilesInFolder error:', error);
    return { ok: false, error: error?.message || '파일 목록 가져오기 실패' };
  }
}

/**
 * Google Drive 파일 ID를 직접 다운로드 URL로 변환 (CDN 최적화)
 * 이미지의 경우 lh3.googleusercontent.com 형식 사용 (더 안정적인 이미지 임베딩)
 * 다른 파일은 다운로드 링크 사용
 */
export function getDriveFileUrl(fileId: string, isImage: boolean = false): string {
  if (isImage) {
    // lh3.googleusercontent.com 형식 사용 - 리다이렉트 없이 직접 이미지 제공
    // 이 형식이 img 태그에서 더 안정적으로 작동함
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  // 다른 파일은 다운로드 링크 사용
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Google Drive 공개 링크를 최적화된 URL로 변환
 */
export function optimizeDriveUrl(url: string, fileId?: string): string {
  // fileId가 있으면 직접 다운로드 링크 사용 (더 빠름)
  if (fileId) {
    // URL에서 fileId 추출 시도
    const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      return getDriveFileUrl(idMatch[1], true);
    }
    return getDriveFileUrl(fileId, true);
  }

  // fileId가 없으면 원본 URL 사용
  return url;
}

export async function uploadFileToDrive(params: UploadParams): Promise<UploadResult> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { folderId, fileName, mimeType = 'application/octet-stream', buffer, makePublic: _makePublic = false } = params;

  // 클라이언트(browser-image-compression)에서 이미 WebP 변환됨 — 서버 변환 불필요
  const uploadBuffer = buffer;
  const uploadMimeType = mimeType;
  const uploadFileName = fileName;

  try {
    const drive = getDriveClient();

    const requestBody: Record<string, any> = {
      name: uploadFileName,
      mimeType: uploadMimeType,
    };

    // Shared Drive 사용 (서비스 계정 스토리지 할당량 문제 해결)
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    // 부모 폴더 설정: folderId가 있으면 우선 사용, 없으면 sharedDriveId 사용
    if (folderId && folderId !== 'root') {
      requestBody.parents = [folderId];
    } else if (sharedDriveId && sharedDriveId !== 'root') {
      requestBody.parents = [sharedDriveId];
    }

    // Buffer를 Readable Stream으로 변환 (googleapis가 pipe 메서드를 기대함)
    const bufferStream = new Readable();
    bufferStream.push(uploadBuffer);
    bufferStream.push(null); // 스트림 종료

    const createOptions: any = {
      requestBody,
      media: {
        mimeType: uploadMimeType,
        body: bufferStream,
      },
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true,
    };

    const response = await drive.files.create(createOptions);

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error('Google Drive 업로드에 실패했습니다 (fileId 없음).');
    }

    // 권한 설정: anyone with link (공개 읽기)
    // 실패 시 업로드된 파일이 403으로 표시되지 않음 → critical
    try {
      const permissionOptions: any = {
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      };
      await drive.permissions.create(permissionOptions);
    } catch (permErr: unknown) {
      console.error('[GoogleDrive] Permission set FAILED — file will be inaccessible (403):', permErr);
      // 접근 불가능한 고아 파일(orphan) 정리 — 실패해도 이미 에러 상황이므로 무시
      try { await drive.files.delete({ fileId, supportsAllDrives: true }); } catch { /* ignore */ }
      return {
        ok: false,
        error: `파일 업로드 후 공개 권한 설정에 실패했습니다. 잠시 후 다시 시도해주세요.`,
      };
    }

    // 이미지인지 확인
    const isImage = uploadMimeType?.startsWith('image/') || false;

    // 최적화된 URL 사용 (CDN 캐싱 최적화)
    const url = getDriveFileUrl(fileId, isImage);

    return { ok: true, fileId, url };
  } catch (error: any) {
    console.error('[GoogleDrive] uploadFileToDrive error:', error);
    console.error('[GoogleDrive] Error details:', {
      message: error?.message,
      code: error?.code,
      response: error?.response?.data,
    });

    // JWT 관련 에러인 경우 더 자세한 메시지 제공
    if (error?.message?.includes('JWT') || error?.message?.includes('invalid_grant') || error?.message?.includes('Invalid JWT')) {
      return {
        ok: false,
        error: `Google Drive 인증 실패 (JWT Signature 오류): ${error?.message}. 환경변수 GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY 또는 GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY의 줄바꿈 문자(\\n) 처리를 확인해주세요.`
      };
    }

    return { ok: false, error: error?.message || 'Google Drive 업로드 실패' };
  }
}

/**
 * Google Drive에서 파일 삭제
 * @param fileIdOrUrl - Google Drive 파일 ID 또는 URL
 * @returns 삭제 성공 여부
 */
export async function deleteFileFromDrive(
  fileIdOrUrl: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const drive = getDriveClient();
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    // URL에서 파일 ID 추출 (다양한 형식 지원)
    let fileId = fileIdOrUrl;
    if (fileIdOrUrl.includes('drive.google.com') || fileIdOrUrl.includes('id=')) {
      // 형식 1: https://drive.google.com/uc?export=view&id=xxx
      const idParamMatch = fileIdOrUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idParamMatch) {
        fileId = idParamMatch[1];
      } else {
        // 형식 2: https://drive.google.com/file/d/xxx/view
        const idPathMatch = fileIdOrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (idPathMatch) {
          fileId = idPathMatch[1];
        } else {
          // 형식 3: 마지막 시도 - 긴 영숫자 문자열 추출
          const idFallbackMatch = fileIdOrUrl.match(/([a-zA-Z0-9_-]{20,})/);
          if (idFallbackMatch) {
            fileId = idFallbackMatch[1];
          } else {
            return { ok: false, error: '유효하지 않은 Google Drive URL입니다.' };
          }
        }
      }
    }

    console.log(`[GoogleDrive] Attempting to delete file: ${fileId}`);

    // 파일 삭제 (Shared Drive 지원)
    const deleteOptions: any = {
      fileId: fileId,
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      deleteOptions.supportsAllDrives = true;
    }

    await drive.files.delete(deleteOptions);

    console.log(`[GoogleDrive] File deleted successfully: ${fileId}`);
    return { ok: true };
  } catch (error: any) {
    console.error('[GoogleDrive] deleteFileFromDrive error:', error);
    console.error('[GoogleDrive] Error details:', {
      message: error?.message,
      code: error?.code,
      fileIdOrUrl,
    });

    // 파일이 이미 삭제된 경우 성공으로 처리
    if (error?.code === 404 || error?.message?.includes('not found') || error?.message?.includes('File not found')) {
      console.log('[GoogleDrive] File already deleted or not found, treating as success');
      return { ok: true };
    }

    return { ok: false, error: error?.message || '파일 삭제 실패' };
  }
}

/**
 * Google Drive 폴더 내 하위 폴더 목록 가져오기
 * @param parentFolderId - 상위 폴더 ID
 * @returns 하위 폴더 목록
 */
export async function listFoldersInFolder(
  parentFolderId: string
): Promise<{ ok: boolean; folders?: Array<{ id: string; name: string; path: string }>; error?: string }> {
  try {
    const drive = getDriveClient();
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    const listOptions: any = {
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      orderBy: 'name',
      pageSize: 100,
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      listOptions.supportsAllDrives = true;
      listOptions.includeItemsFromAllDrives = true;
      listOptions.corpora = 'allDrives';
    }

    const response = await drive.files.list(listOptions);

    const folders = (response.data.files || []).map(folder => ({
      id: folder.id || '',
      name: folder.name || '',
      path: folder.name || '', // 단일 레벨에서는 이름이 경로
    }));

    return { ok: true, folders };
  } catch (error: any) {
    console.error('[GoogleDrive] listFoldersInFolder error:', error);
    return { ok: false, error: error?.message || '폴더 목록 가져오기 실패' };
  }
}

/**
 * Google Drive에서 파일을 다른 폴더로 이동
 * @param fileId - 이동할 파일 ID
 * @param targetFolderId - 대상 폴더 ID
 * @param currentFolderId - 현재 폴더 ID (선택)
 * @returns 이동 성공 여부
 */
export async function moveFileToFolder(
  fileId: string,
  targetFolderId: string,
  currentFolderId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const drive = getDriveClient();
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    // 현재 부모 폴더 가져오기
    const fileOptions: any = {
      fileId,
      fields: 'parents',
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      fileOptions.supportsAllDrives = true;
    }

    const file = await drive.files.get(fileOptions);
    const previousParents = currentFolderId || (file.data.parents ? file.data.parents.join(',') : '');

    // 파일 이동
    const updateOptions: any = {
      fileId,
      addParents: targetFolderId,
      removeParents: previousParents,
      fields: 'id, parents',
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      updateOptions.supportsAllDrives = true;
    }

    await drive.files.update(updateOptions);

    return { ok: true };
  } catch (error: any) {
    console.error('[GoogleDrive] moveFileToFolder error:', error);
    return { ok: false, error: error?.message || '파일 이동 실패' };
  }
}

/**
 * Google Drive 폴더 생성 (간단 버전)
 * @param folderName - 생성할 폴더 이름
 * @param parentFolderId - 상위 폴더 ID
 * @returns 생성된 폴더 ID
 */
export async function createFolder(
  folderName: string,
  parentFolderId: string
): Promise<{ ok: boolean; folderId?: string; error?: string }> {
  try {
    const drive = getDriveClient();
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    const createBody: Record<string, any> = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    };

    const createOptions: any = {
      requestBody: createBody,
      fields: 'id, name',
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      createOptions.supportsAllDrives = true;
    }

    const response = await drive.files.create(createOptions);

    if (!response.data.id) {
      throw new Error('폴더 생성에 실패했습니다.');
    }

    return { ok: true, folderId: response.data.id };
  } catch (error: any) {
    console.error('[GoogleDrive] createFolder error:', error);
    return { ok: false, error: error?.message || '폴더 생성 실패' };
  }
}

/**
 * Google Drive 폴더 이름 변경
 * @param folderId - 변경할 폴더 ID
 * @param newName - 새로운 폴더 이름
 * @returns 변경 성공 여부
 */
export async function renameFolder(
  folderId: string,
  newName: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const drive = getDriveClient();
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    const updateOptions: any = {
      fileId: folderId,
      requestBody: {
        name: newName,
      },
      fields: 'id, name',
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      updateOptions.supportsAllDrives = true;
    }

    await drive.files.update(updateOptions);

    return { ok: true };
  } catch (error: any) {
    console.error('[GoogleDrive] renameFolder error:', error);
    return { ok: false, error: error?.message || '폴더 이름 변경 실패' };
  }
}

// getDriveClient는 내부 함수이므로 export하지 않음
// 테스트는 findOrCreateFolder나 uploadFileToDrive를 통해 간접적으로 테스트
