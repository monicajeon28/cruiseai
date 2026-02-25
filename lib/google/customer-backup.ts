import { google } from 'googleapis';
import { getGoogleAuth } from '@/lib/google-drive';
import prisma from '@/lib/prisma';

// 고객 관리 백업 스프레드시트 ID
const CUSTOMER_BACKUP_SPREADSHEET_ID = '11_cfi841QGIDaBmYdjdk3aHYp2UYpCnx1QVVrgV7QJY';

// 뱃지 유형 정의
type BadgeType =
  | '3일체험'
  | '지니체험'
  | 'B2B유입'
  | 'B2B시스템'
  | '크루즈몰'
  | '전화문의'
  | '랜딩유입'
  | '구매확정'
  | '환불'
  | '재구매';

// 고객 유형 판별 함수
function getCustomerBadges(customer: {
  testModeStartedAt: Date | null;
  customerStatus: string | null;
  customerSource: string | null;
  mallUserId: string | null;
  totalTripCount?: number;
}): BadgeType[] {
  const badges: BadgeType[] = [];

  // 3일체험
  const isTrialUser = !!customer.testModeStartedAt ||
    (customer.customerStatus === 'test' && customer.customerSource === 'test-guide') ||
    (customer.customerStatus === 'test-locked' && customer.customerSource === 'test-guide');
  if (isTrialUser) badges.push('3일체험');

  // 지니체험 (결제 고객)
  const isRegularGenie = !customer.testModeStartedAt &&
    customer.customerStatus !== 'test' &&
    customer.customerStatus !== 'test-locked' &&
    (customer.customerStatus === 'active' || customer.customerStatus === 'package') &&
    customer.customerSource === 'cruise-guide';
  if (isRegularGenie) badges.push('지니체험');

  // B2B유입
  if (customer.customerSource === 'B2B_INFLOW') badges.push('B2B유입');

  // B2B시스템
  if (customer.customerSource === 'TRIAL_DASHBOARD') badges.push('B2B시스템');

  // B2B유입 (파트너 랜딩)
  if (customer.customerSource === 'B2B_LANDING') badges.push('B2B유입');

  // 크루즈몰
  if (customer.mallUserId) badges.push('크루즈몰');

  // 전화문의
  if (customer.customerSource === 'phone-consultation') badges.push('전화문의');

  // 랜딩유입
  if (customer.customerSource === 'landing-page') badges.push('랜딩유입');

  // 구매확정
  if (customer.customerStatus === 'purchase_confirmed') badges.push('구매확정');

  // 환불
  if (customer.customerStatus === 'refunded') badges.push('환불');

  // 재구매
  if ((customer.totalTripCount || 0) >= 2) badges.push('재구매');

  return badges;
}

// AffiliateProfile type을 한글 직급으로 변환
function getPositionLabel(type: string | null): string {
  if (!type) return '-';
  switch (type) {
    case 'BRANCH_MANAGER':
      return '대리점장';
    case 'SALES_AGENT':
      return '판매원';
    case 'ADMIN':
      return '관리자';
    default:
      return type;
  }
}

interface CustomerBackupData {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  badges: string;
  customerStatus: string | null;
  customerSource: string | null;
  totalTripCount: number;
  managerName: string;
  managerPosition: string;
  managerPhone: string | null;
  // 담당자 (계약서상 이름)
  contractAgentName: string | null;
  // 여권 관련 정보
  passportGroupLink: string | null;
  passportStatus: string | null;
  // 여행자 여권 정보 (대표자)
  travelerPassportNo: string | null;
  travelerPassportImage: string | null;
  travelerPassportExpiry: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 모든 고객 데이터를 가져와서 뱃지, 담당자 정보, 여권 정보 포함
 */
async function getAllCustomersWithDetails(): Promise<CustomerBackupData[]> {
  const users = await prisma.user.findMany({
    where: {
      // 'user', 'community' 역할을 고객으로 간주 (admin 제외)
      role: { in: ['user', 'community', 'PROSPECT'] },
    },
    include: {
      Reservation: {
        include: {
          AffiliateSale: {
            include: {
              AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
                select: {
                  displayName: true,
                  type: true,
                  contactPhone: true,
                  // 계약서상 이름 (legalName)
                  legalName: true,
                },
              },
            },
          },
          // 여행자 정보 (여권 포함)
          Traveler: {
            select: {
              passportNo: true,
              passportImage: true,
              expiryDate: true,
              korName: true,
            },
            take: 1,
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result: CustomerBackupData[] = [];

  for (const user of users) {
    // 총 여행 횟수 계산 (재구매 판단용)
    const tripCount = await prisma.reservation.count({
      where: { userId: user.id },
    });

    // 뱃지 계산
    const badges = getCustomerBadges({
      testModeStartedAt: user.testModeStartedAt,
      customerStatus: user.customerStatus,
      customerSource: user.customerSource,
      mallUserId: user.mallUserId,
      totalTripCount: tripCount,
    });

    // 담당자 정보 (가장 최근 예약의 담당자)
    const latestReservation = user.Reservation[0];
    const agentProfile = latestReservation?.AffiliateSale?.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile;

    // 대표 여행자 정보
    const mainTraveler = latestReservation?.Traveler?.[0];

    result.push({
      id: user.id,
      name: user.name || '-',
      phone: user.phone || '-',
      email: user.email,
      badges: badges.length > 0 ? badges.join(', ') : '-',
      customerStatus: user.customerStatus,
      customerSource: user.customerSource,
      totalTripCount: tripCount,
      managerName: agentProfile?.displayName || '-',
      managerPosition: getPositionLabel(agentProfile?.type || null),
      managerPhone: agentProfile?.contactPhone || null,
      // 계약서상 이름 (legalName) 또는 예약의 agentName
      contractAgentName: (agentProfile as any)?.legalName || latestReservation?.agentName || null,
      // 여권 관련 정보
      passportGroupLink: latestReservation?.passportGroupLink || null,
      passportStatus: latestReservation?.passportStatus || null,
      // 여행자 여권 정보
      travelerPassportNo: mainTraveler?.passportNo || null,
      travelerPassportImage: mainTraveler?.passportImage || null,
      travelerPassportExpiry: mainTraveler?.expiryDate || null,
      createdAt: user.createdAt ? new Date(user.createdAt).toLocaleString('ko-KR') : '-',
      updatedAt: user.updatedAt ? new Date(user.updatedAt).toLocaleString('ko-KR') : '-',
    });
  }

  return result;
}

/**
 * 전체 고객 목록을 Google 스프레드시트에 백업
 */
export async function backupAllCustomersToSheet(): Promise<{
  ok: boolean;
  totalCount: number;
  error?: string;
}> {
  try {
    const customers = await getAllCustomersWithDetails();

    if (customers.length === 0) {
      return { ok: true, totalCount: 0 };
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 시트 초기화 - 기존 데이터 삭제 후 새로 작성
    const sheetName = '전체 고객';

    // 헤더 + 데이터 생성
    const header = [
      'ID', '이름', '연락처', '이메일', '뱃지',
      '상태', '출처', '여행횟수',
      '담당자 이름', '담당자 직급', '담당자 연락처',
      '등록일', '최종수정일'
    ];

    const rows = customers.map(c => [
      c.id.toString(),
      c.name,
      c.phone,
      c.email || '',
      c.badges,
      c.customerStatus || '',
      c.customerSource || '',
      c.totalTripCount.toString(),
      c.managerName,
      c.managerPosition,
      c.managerPhone || '',
      c.createdAt,
      c.updatedAt,
    ]);

    const values = [header, ...rows];

    // 시트 데이터 덮어쓰기
    await sheets.spreadsheets.values.update({
      spreadsheetId: CUSTOMER_BACKUP_SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`[Customer Backup] Successfully backed up ${customers.length} customers to "${sheetName}" sheet`);

    return { ok: true, totalCount: customers.length };
  } catch (error: any) {
    console.error('[Customer Backup] Failed:', error);
    return { ok: false, totalCount: 0, error: error.message };
  }
}

/**
 * 뱃지별 고객 목록을 각 시트에 백업
 */
export async function backupCustomersByBadgeToSheet(): Promise<{
  ok: boolean;
  badgeCounts: Record<string, number>;
  error?: string;
}> {
  try {
    const customers = await getAllCustomersWithDetails();

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 뱃지별로 고객 분류
    const badgeGroups: Record<string, CustomerBackupData[]> = {
      '3일체험': [],
      '지니체험': [],
      'B2B유입': [],
      'B2B시스템': [],
      '크루즈몰': [],
      '전화문의': [],
      '랜딩유입': [],
      '구매확정': [],
      '환불': [],
      '재구매': [],
    };

    for (const customer of customers) {
      const badges = customer.badges.split(', ').filter(b => b !== '-');
      for (const badge of badges) {
        if (badgeGroups[badge]) {
          badgeGroups[badge].push(customer);
        }
      }
    }

    const badgeCounts: Record<string, number> = {};

    // 각 뱃지별 시트에 데이터 작성
    for (const [badge, badgeCustomers] of Object.entries(badgeGroups)) {
      if (badgeCustomers.length === 0) {
        badgeCounts[badge] = 0;
        continue;
      }

      const sheetName = badge;

      const header = [
        'ID', '이름', '연락처', '이메일', '전체뱃지',
        '상태', '출처', '여행횟수',
        '담당자 이름', '담당자 직급', '담당자 연락처',
        '등록일', '최종수정일'
      ];

      const rows = badgeCustomers.map(c => [
        c.id.toString(),
        c.name,
        c.phone,
        c.email || '',
        c.badges,
        c.customerStatus || '',
        c.customerSource || '',
        c.totalTripCount.toString(),
        c.managerName,
        c.managerPosition,
        c.managerPhone || '',
        c.createdAt,
        c.updatedAt,
      ]);

      const values = [header, ...rows];

      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: CUSTOMER_BACKUP_SPREADSHEET_ID,
          range: `'${sheetName}'!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });
        badgeCounts[badge] = badgeCustomers.length;
        console.log(`[Customer Backup] Backed up ${badgeCustomers.length} customers to "${sheetName}" sheet`);
      } catch (sheetError: any) {
        // 시트가 없으면 스킵 (사전에 시트 생성 필요)
        console.warn(`[Customer Backup] Sheet "${sheetName}" may not exist:`, sheetError.message);
        badgeCounts[badge] = 0;
      }
    }

    return { ok: true, badgeCounts };
  } catch (error: any) {
    console.error('[Customer Backup] Failed:', error);
    return { ok: false, badgeCounts: {}, error: error.message };
  }
}

/**
 * 담당자별 고객 목록 백업 (대리점장/판매원 기준)
 */
export async function backupCustomersByManagerToSheet(): Promise<{
  ok: boolean;
  managerCounts: Record<string, number>;
  error?: string;
}> {
  try {
    const customers = await getAllCustomersWithDetails();

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 담당자별로 고객 분류
    const managerGroups: Record<string, CustomerBackupData[]> = {};

    for (const customer of customers) {
      const key = `${customer.managerName} (${customer.managerPosition})`;
      if (!managerGroups[key]) {
        managerGroups[key] = [];
      }
      managerGroups[key].push(customer);
    }

    const managerCounts: Record<string, number> = {};
    const sheetName = '담당자별고객';

    // 모든 담당자별 데이터를 하나의 시트에 정리
    const header = [
      '담당자', '직급', 'ID', '고객이름', '연락처', '이메일',
      '뱃지', '상태', '출처', '여행횟수', '등록일'
    ];

    const rows: string[][] = [];
    for (const [managerKey, managerCustomers] of Object.entries(managerGroups)) {
      const [name, position] = managerKey.replace(')', '').split(' (');

      for (const c of managerCustomers) {
        rows.push([
          name || '-',
          position || '-',
          c.id.toString(),
          c.name,
          c.phone,
          c.email || '',
          c.badges,
          c.customerStatus || '',
          c.customerSource || '',
          c.totalTripCount.toString(),
          c.createdAt,
        ]);
      }
      managerCounts[managerKey] = managerCustomers.length;
    }

    // 담당자 이름 기준으로 정렬
    rows.sort((a, b) => a[0].localeCompare(b[0]));

    const values = [header, ...rows];

    await sheets.spreadsheets.values.update({
      spreadsheetId: CUSTOMER_BACKUP_SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`[Customer Backup] Backed up customers by manager to "${sheetName}" sheet`);

    return { ok: true, managerCounts };
  } catch (error: any) {
    console.error('[Customer Backup] Failed:', error);
    return { ok: false, managerCounts: {}, error: error.message };
  }
}

/**
 * 상담기록 시트에 백업 (녹음파일 링크 포함)
 * CustomerNote(관리자) + AffiliateInteraction(파트너) 통합 백업
 */
export async function backupConsultationNotesToSheet(): Promise<{
  ok: boolean;
  totalCount: number;
  error?: string;
}> {
  try {
    // 1. 관리자 상담기록 (CustomerNote) 조회
    const customerNotes = await prisma.customerNote.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        User_CustomerNote_customerIdToUser: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    // 2. 파트너 상담기록 (AffiliateInteraction) 조회
    const affiliateInteractions = await prisma.affiliateInteraction.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        AffiliateLead: {
          select: {
            id: true,
            customerName: true,
            customerPhone: true,
          },
        },
        AffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            type: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        AffiliateMedia: {
          select: {
            id: true,
            storagePath: true,
            mimeType: true,
            metadata: true,
          },
        },
      },
    });

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const sheetName = '상담기록';

    // 헤더 + 데이터 생성 (통합 포맷)
    const header = [
      '기록유형', '기록ID', '고객ID', '고객이름', '고객연락처',
      '상담일시', '상담내용', '상담자', '상담자유형',
      '다음조치일', '다음조치메모', '상담후상태',
      '녹음파일링크', '등록일'
    ];

    // CustomerNote 데이터 변환
    const noteRows = customerNotes.map(note => {
      const customer = note.User_CustomerNote_customerIdToUser;
      return [
        '본사기록',
        `N-${note.id}`,
        customer?.id?.toString() || '',
        customer?.name || '-',
        customer?.phone || '-',
        note.consultedAt ? new Date(note.consultedAt).toLocaleString('ko-KR') : new Date(note.createdAt).toLocaleString('ko-KR'),
        note.content,
        note.createdByName || '-',
        note.createdByType === 'BRANCH_MANAGER' ? '대리점장' :
          note.createdByType === 'SALES_AGENT' ? '판매원' : '본사',
        note.nextActionDate ? new Date(note.nextActionDate).toLocaleDateString('ko-KR') : '',
        note.nextActionNote || '',
        note.statusAfter || '',
        note.audioFileUrl || '',
        new Date(note.createdAt).toLocaleString('ko-KR'),
      ];
    });

    // AffiliateInteraction 데이터 변환
    const interactionRows = affiliateInteractions.map(interaction => {
      const lead = interaction.AffiliateLead;
      const profile = interaction.AffiliateProfile;
      const user = interaction.User;

      // 오디오 파일 찾기
      const audioMedia = interaction.AffiliateMedia?.find(m =>
        m.mimeType?.startsWith('audio/') ||
        m.storagePath?.match(/\.(mp3|wav|m4a|ogg|webm)$/i)
      );
      const audioUrl = audioMedia?.storagePath ||
        (audioMedia?.metadata as any)?.googleDriveUrl || '';

      return [
        '파트너기록',
        `I-${interaction.id}`,
        lead?.id?.toString() || '',
        lead?.customerName || '-',
        lead?.customerPhone || '-',
        new Date(interaction.occurredAt).toLocaleString('ko-KR'),
        interaction.note || '-',
        profile?.displayName || user?.name || '-',
        profile?.type === 'BRANCH_MANAGER' ? '대리점장' :
          profile?.type === 'SALES_AGENT' ? '판매원' : '본사',
        '', // 다음조치일 (AffiliateInteraction에는 없음, AffiliateLead에 있음)
        '', // 다음조치메모
        interaction.interactionType || '', // 상담후상태 대신 상호작용 유형
        audioUrl,
        new Date(interaction.createdAt).toLocaleString('ko-KR'),
      ];
    });

    // 모든 기록 통합 (최신순 정렬)
    const allRows = [...noteRows, ...interactionRows].sort((a, b) => {
      const dateA = new Date(a[13] as string); // 등록일 기준
      const dateB = new Date(b[13] as string);
      return dateB.getTime() - dateA.getTime();
    });

    if (allRows.length === 0) {
      return { ok: true, totalCount: 0 };
    }

    const values = [header, ...allRows];

    await sheets.spreadsheets.values.update({
      spreadsheetId: CUSTOMER_BACKUP_SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`[Customer Backup] Backed up ${allRows.length} consultation records (${customerNotes.length} notes + ${affiliateInteractions.length} interactions) to "${sheetName}" sheet`);

    return { ok: true, totalCount: allRows.length };
  } catch (error: any) {
    console.error('[Customer Backup] Consultation notes backup failed:', error);
    return { ok: false, totalCount: 0, error: error.message };
  }
}

/**
 * 담당자별 상담기록 백업 (판매원/대리점장별 시트)
 */
export async function backupConsultationsByManagerToSheet(): Promise<{
  ok: boolean;
  managerCounts: Record<string, number>;
  error?: string;
}> {
  try {
    // 모든 상담기록 조회 (CustomerNote + AffiliateInteraction)
    const customerNotes = await prisma.customerNote.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        User_CustomerNote_customerIdToUser: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    const affiliateInteractions = await prisma.affiliateInteraction.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        AffiliateLead: {
          select: { id: true, customerName: true, customerPhone: true, userId: true },
        },
        AffiliateProfile: {
          select: { id: true, displayName: true, type: true },
        },
        User: {
          select: { id: true, name: true },
        },
        AffiliateMedia: {
          select: { storagePath: true, mimeType: true, metadata: true },
        },
      },
    });

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 담당자별로 분류
    const managerGroups: Record<string, any[]> = {};

    // CustomerNote 분류
    for (const note of customerNotes) {
      const managerKey = `${note.createdByName || '본사'} (${
        note.createdByType === 'BRANCH_MANAGER' ? '대리점장' :
        note.createdByType === 'SALES_AGENT' ? '판매원' : '본사'
      })`;

      if (!managerGroups[managerKey]) {
        managerGroups[managerKey] = [];
      }

      const customer = note.User_CustomerNote_customerIdToUser;
      managerGroups[managerKey].push({
        type: '본사기록',
        id: `N-${note.id}`,
        customerId: customer?.id?.toString() || '',
        customerName: customer?.name || '-',
        customerPhone: customer?.phone || '-',
        date: note.consultedAt || note.createdAt,
        content: note.content,
        nextActionDate: note.nextActionDate,
        nextActionNote: note.nextActionNote,
        statusAfter: note.statusAfter,
        audioUrl: note.audioFileUrl || '',
        createdAt: note.createdAt,
      });
    }

    // AffiliateInteraction 분류
    for (const interaction of affiliateInteractions) {
      const profile = interaction.AffiliateProfile;
      const managerKey = `${profile?.displayName || interaction.User?.name || '본사'} (${
        profile?.type === 'BRANCH_MANAGER' ? '대리점장' :
        profile?.type === 'SALES_AGENT' ? '판매원' : '본사'
      })`;

      if (!managerGroups[managerKey]) {
        managerGroups[managerKey] = [];
      }

      const lead = interaction.AffiliateLead;
      const audioMedia = interaction.AffiliateMedia?.find(m =>
        m.mimeType?.startsWith('audio/')
      );

      managerGroups[managerKey].push({
        type: '파트너기록',
        id: `I-${interaction.id}`,
        customerId: lead?.userId?.toString() || lead?.id?.toString() || '',
        customerName: lead?.customerName || '-',
        customerPhone: lead?.customerPhone || '-',
        date: interaction.occurredAt,
        content: interaction.note || '-',
        nextActionDate: null,
        nextActionNote: null,
        statusAfter: interaction.interactionType,
        audioUrl: audioMedia?.storagePath || '',
        createdAt: interaction.createdAt,
      });
    }

    const managerCounts: Record<string, number> = {};
    const sheetName = '담당자별상담기록';

    // 모든 담당자별 데이터를 하나의 시트에 정리
    const header = [
      '담당자', '기록유형', '기록ID', '고객ID', '고객이름', '고객연락처',
      '상담일시', '상담내용', '다음조치일', '다음조치메모', '상태',
      '녹음파일링크', '등록일'
    ];

    const rows: string[][] = [];
    for (const [managerKey, records] of Object.entries(managerGroups)) {
      for (const record of records) {
        rows.push([
          managerKey,
          record.type,
          record.id,
          record.customerId,
          record.customerName,
          record.customerPhone,
          new Date(record.date).toLocaleString('ko-KR'),
          record.content,
          record.nextActionDate ? new Date(record.nextActionDate).toLocaleDateString('ko-KR') : '',
          record.nextActionNote || '',
          record.statusAfter || '',
          record.audioUrl,
          new Date(record.createdAt).toLocaleString('ko-KR'),
        ]);
      }
      managerCounts[managerKey] = records.length;
    }

    // 담당자 이름 기준으로 정렬
    rows.sort((a, b) => a[0].localeCompare(b[0]));

    const values = [header, ...rows];

    await sheets.spreadsheets.values.update({
      spreadsheetId: CUSTOMER_BACKUP_SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`[Customer Backup] Backed up consultations by manager to "${sheetName}" sheet`);

    return { ok: true, managerCounts };
  } catch (error: any) {
    console.error('[Customer Backup] Consultations by manager backup failed:', error);
    return { ok: false, managerCounts: {}, error: error.message };
  }
}

/**
 * 특정 고객의 정보만 백업 (상담기록 추가 시 호출)
 */
export async function backupCustomerToSheet(customerId: number): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    // 해당 고객의 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: customerId },
      include: {
        Reservation: {
          include: {
            AffiliateSale: {
              include: {
                AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
                  select: {
                    displayName: true,
                    type: true,
                    contactPhone: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        CustomerNote_CustomerNote_customerIdToUser: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return { ok: false, error: '고객을 찾을 수 없습니다.' };
    }

    // 전체 백업 실행 (개별 고객 백업은 전체 백업으로 대체)
    // 실시간 개별 업데이트가 필요하면 여기서 구현
    console.log(`[Customer Backup] Triggering full backup for customer ${customerId}`);

    // 비동기로 전체 백업 실행
    runFullCustomerBackup().catch(err => {
      console.error('[Customer Backup] Background backup failed:', err);
    });

    return { ok: true };
  } catch (error: any) {
    console.error('[Customer Backup] Single customer backup failed:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * 전체 고객 백업 실행 (전체 + 뱃지별 + 담당자별 + 상담기록 + 담당자별 상담기록)
 */
export async function runFullCustomerBackup(): Promise<{
  ok: boolean;
  summary: {
    totalCustomers: number;
    badgeCounts: Record<string, number>;
    managerCounts: Record<string, number>;
    consultationCount: number;
    consultationByManagerCounts: Record<string, number>;
  };
  error?: string;
}> {
  console.log('[Customer Backup] Starting full backup...');

  try {
    // 1. 전체 고객 백업
    const allResult = await backupAllCustomersToSheet();
    if (!allResult.ok) {
      return {
        ok: false,
        summary: { totalCustomers: 0, badgeCounts: {}, managerCounts: {}, consultationCount: 0, consultationByManagerCounts: {} },
        error: allResult.error
      };
    }

    // 2. 뱃지별 백업
    const badgeResult = await backupCustomersByBadgeToSheet();

    // 3. 담당자별 고객 백업
    const managerResult = await backupCustomersByManagerToSheet();

    // 4. 상담기록 통합 백업 (CustomerNote + AffiliateInteraction, 녹음파일 링크 포함)
    const consultationResult = await backupConsultationNotesToSheet();

    // 5. 담당자별 상담기록 백업
    const consultationByManagerResult = await backupConsultationsByManagerToSheet();

    console.log('[Customer Backup] Full backup completed');

    return {
      ok: true,
      summary: {
        totalCustomers: allResult.totalCount,
        badgeCounts: badgeResult.badgeCounts,
        managerCounts: managerResult.managerCounts,
        consultationCount: consultationResult.totalCount,
        consultationByManagerCounts: consultationByManagerResult.managerCounts,
      },
    };
  } catch (error: any) {
    console.error('[Customer Backup] Full backup failed:', error);
    return {
      ok: false,
      summary: { totalCustomers: 0, badgeCounts: {}, managerCounts: {}, consultationCount: 0, consultationByManagerCounts: {} },
      error: error.message,
    };
  }
}

// 여행 예약 백업용 스프레드시트 ID
const RESERVATION_BACKUP_SPREADSHEET_ID = '1Le6IPNzyvMqpn-6ZnqgvH0JTQ8O5rKymWMU_pkfbQ5Q';

/**
 * 여행 예약 + 여행자(여권) 정보를 스프레드시트에 백업
 * 양식: 순번, 예약일(구매일), 예약번호(상품코드), 상품명, 출발일, 카테고리(PNR객실),
 *       영문성, 영문이름, 성명, 주민번호, 성별, 생년월일, 여권번호, 여권생성일, 여권만료일,
 *       고객연락처, 항공, 결제일, 결제방법, 결제금액, 연결담당자, 최종수정자, 최종수정일시, 비고, 여권링크
 */
export async function backupReservationsToSheet(): Promise<{
  ok: boolean;
  totalCount: number;
  error?: string;
}> {
  try {
    // 모든 예약 + 여행자 정보 조회
    const reservations = await prisma.reservation.findMany({
      include: {
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        Trip: {
          select: {
            productCode: true,
            shipName: true,
            departureDate: true,
          },
        },
        AffiliateSale: {
          include: {
            AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile: {
              select: {
                displayName: true,
                legalName: true,
                type: true,
              },
            },
            Payment: {
              select: {
                paidAt: true,
              },
            },
          },
        },
        Traveler: {
          orderBy: { roomNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (reservations.length === 0) {
      return { ok: true, totalCount: 0 };
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const sheetName = '예약목록';

    // 헤더 (지정된 양식)
    const header = [
      '순번', '예약일', '예약번호', '상품명', '출발일', '카테고리',
      '영문성', '영문이름', '성명', '주민번호', '성별', '생년월일',
      '여권번호', '여권생성일', '여권만료일', '고객연락처',
      '항공', '결제일', '결제방법', '결제금액',
      '연결담당자', '최종수정자', '최종수정일시', '비고', '여권링크'
    ];

    const rows: string[][] = [];
    let rowNum = 1;

    for (const reservation of reservations) {
      const travelers = reservation.Traveler || [];
      const agent = reservation.AffiliateSale?.AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile;
      const sale = reservation.AffiliateSale;

      // 담당자 이름 (계약서상 이름 또는 표시명)
      const agentName = (agent as any)?.legalName || agent?.displayName || reservation.agentName || '-';

      // 구매일 (결제일 우선, 없으면 saleDate, 없으면 예약생성일)
      const purchaseDate = sale?.Payment?.paidAt
        ? new Date(sale.Payment.paidAt).toLocaleDateString('ko-KR')
        : sale?.saleDate
          ? new Date(sale.saleDate).toLocaleDateString('ko-KR')
          : reservation.createdAt
            ? new Date(reservation.createdAt).toLocaleDateString('ko-KR')
            : '';

      // 상품코드
      const productCode = reservation.Trip?.productCode || '';

      // 여행자가 없으면 예약 정보만 한 줄로
      if (travelers.length === 0) {
        rows.push([
          rowNum.toString(),
          purchaseDate, // 예약일 = 구매일
          productCode, // 예약번호 = 상품코드
          reservation.Trip?.shipName || '', // 상품명
          reservation.Trip?.departureDate ? new Date(reservation.Trip.departureDate).toLocaleDateString('ko-KR') : '', // 출발일
          reservation.cabinType || '', // 카테고리 = PNR 객실유형
          '', // 영문성
          '', // 영문이름
          reservation.User?.name || '', // 성명
          '', // 주민번호
          '', // 성별
          '', // 생년월일
          '', // 여권번호
          '', // 여권생성일
          '', // 여권만료일
          reservation.User?.phone || '', // 고객연락처
          (reservation as any).airlineName || '', // 항공
          reservation.paymentDate ? new Date(reservation.paymentDate).toLocaleDateString('ko-KR') : '', // 결제일
          reservation.paymentMethod || '', // 결제방법
          reservation.paymentAmount?.toString() || '', // 결제금액
          agentName, // 연결담당자
          (reservation as any).lastModifiedByName || '', // 최종수정자
          reservation.updatedAt ? new Date(reservation.updatedAt).toLocaleString('ko-KR') : '', // 최종수정일시
          reservation.remarks || '', // 비고
          reservation.passportGroupLink || '', // 여권링크
        ]);
        rowNum++;
      } else {
        // 각 여행자별로 한 줄씩
        for (const traveler of travelers) {
          // 카테고리: cabinType + roomNumber (예: 인사이드1)
          const cabinCategory = reservation.cabinType
            ? `${reservation.cabinType}${traveler.roomNumber || ''}`
            : traveler.roomNumber?.toString() || '';

          rows.push([
            rowNum.toString(),
            purchaseDate, // 예약일 = 구매일
            productCode, // 예약번호 = 상품코드
            reservation.Trip?.shipName || '', // 상품명
            reservation.Trip?.departureDate ? new Date(reservation.Trip.departureDate).toLocaleDateString('ko-KR') : '', // 출발일
            cabinCategory, // 카테고리 = PNR 객실유형 + 번호
            traveler.engSurname || '', // 영문성
            traveler.engGivenName || '', // 영문이름
            traveler.korName || reservation.User?.name || '', // 성명
            traveler.residentNum || '', // 주민번호
            traveler.gender === 'M' ? '남' : traveler.gender === 'F' ? '여' : traveler.gender || '', // 성별
            traveler.birthDate || '', // 생년월일
            traveler.passportNo || '', // 여권번호
            traveler.issueDate || '', // 여권생성일
            traveler.expiryDate || '', // 여권만료일
            traveler.phone || reservation.User?.phone || '', // 고객연락처
            (reservation as any).airlineName || '', // 항공
            reservation.paymentDate ? new Date(reservation.paymentDate).toLocaleDateString('ko-KR') : '', // 결제일
            reservation.paymentMethod || '', // 결제방법
            reservation.paymentAmount?.toString() || '', // 결제금액
            agentName, // 연결담당자
            (reservation as any).lastModifiedByName || '', // 최종수정자
            reservation.updatedAt ? new Date(reservation.updatedAt).toLocaleString('ko-KR') : '', // 최종수정일시
            traveler.notes || reservation.remarks || '', // 비고
            traveler.passportImage || reservation.passportGroupLink || '', // 여권링크
          ]);
          rowNum++;
        }
      }
    }

    const values = [header, ...rows];

    // 시트 데이터 덮어쓰기
    await sheets.spreadsheets.values.update({
      spreadsheetId: RESERVATION_BACKUP_SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`[Reservation Backup] Successfully backed up ${rows.length} travelers from ${reservations.length} reservations to "${sheetName}" sheet`);

    return { ok: true, totalCount: rows.length };
  } catch (error: any) {
    console.error('[Reservation Backup] Failed:', error);
    return { ok: false, totalCount: 0, error: error.message };
  }
}
