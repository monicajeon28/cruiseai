/**
 * Customer 타입 정의
 * 모든 유저는 이 구조를 따른다.
 */

export interface Customer {
  id: number;
  name: string | null;
  phone: string | null; // 식별자 (로그인 ID 역할)

  // 1. 고객 유형 (가장 중요)
  customerType?: 
    | 'test'          // 3일 무료 체험 (비번 1101)
    | 'cruise-guide'  // 유료 서비스 고객 (비번 3800)
    | 'mall'          // 크루즈몰 일반 회원
    | 'prospect'      // 잠재 고객 (DB에는 있는데 가입 안 함)
    | 'partner'       // 파트너 (판매원/대리점장)
    | 'admin';        // 관리자

  // 2. 서비스 상태
  status?: 
    | 'active'      // 정상 이용 중
    | 'package'     // 패키지 이용 중
    | 'dormant'     // 휴면
    | 'locked'      // 잠김 (관리자 차단)
    | 'test-locked'; // 체험 기간 만료

  // 3. 역할 (권한 레벨)
  role?: 'user' | 'admin'; 

  // 4. 파트너 연결 정보 (영업 관리용)
  affiliateOwnership?: {
    ownerType: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT'; // 소속 (본사/대리점/판매원)
    ownerName: string | null;     // 담당자 이름
    managerProfile: any | null;   // 상위 담당자 (판매원일 경우 대리점장)
  } | null;

  // 5. 여행 정보 연결 (Trip 대신 UserTrip 사용!)
  trips: {
    id: number;
    cruiseName: string | null;
    startDate: string | null;
    endDate: string | null;
  }[];
}







