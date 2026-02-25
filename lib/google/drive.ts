import { google } from 'googleapis';

// 구글 드라이브 OAuth 설정
export function getGoogleDriveAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/google/callback`
  );

  return oauth2Client;
}

// 구글 드라이브 인증 URL 생성
export function getGoogleAuthUrl() {
  const oauth2Client = getGoogleDriveAuth();
  
  const scopes = [
    'https://www.googleapis.com/auth/drive.file', // 파일 업로드 권한
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
}

// 구글 드라이브에 파일 업로드
export async function uploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string = 'video/webm'
) {
  const oauth2Client = getGoogleDriveAuth();
  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // 파일 업로드
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: mimeType,
    },
    media: {
      mimeType: mimeType,
      body: fileBuffer,
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  return response.data;
}

// 사용자 정보 가져오기
export async function getGoogleUserInfo(accessToken: string) {
  const oauth2Client = getGoogleDriveAuth();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  return userInfo.data;
}

// 구글 드라이브 폴더 목록 가져오기
export async function getGoogleDriveFolders(accessToken: string) {
  const oauth2Client = getGoogleDriveAuth();
  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id, name, parents)',
    orderBy: 'name',
    pageSize: 100,
  });

  return response.data.files || [];
}

// 특정 폴더에 파일 업로드
export async function uploadToGoogleDriveFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string = 'video/webm'
) {
  const oauth2Client = getGoogleDriveAuth();
  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // 파일 업로드
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: mimeType,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType,
      body: fileBuffer,
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  return response.data;
}

