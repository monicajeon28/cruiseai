# 크루즈닷AI 자동 온보딩 시스템 작업지시서
## APIS → cruiseai.co.kr 첫 로그인 자동 연동

**작성일**: 2026-02-26
**상태**: Phase 1 구현 완료 ✅

---

## 📋 배경 및 목적

크루즈몰(cruisedot.co.kr)에서 상품을 구매한 고객이 크루즈AI(cruiseai.co.kr)에 **첫 로그인**할 때:

- ❌ 기존: 구매자가 직접 여행 정보를 입력해야 함 (온보딩 폼)
- ✅ 목표: 크루즈몰에서 어드민이 등록한 APIS 데이터를 **자동 표시** (No Forms!)

> "와, 내 여행이 여기 이미 들어와 있네!" — 고객 감동 경험 목표

---

## 🏗️ 시스템 아키텍처

### 데이터 흐름
```
[크루즈몰 어드민] → DB에 등록
  User (phone, password=3800)
  UserTrip (cruiseName, startDate, endDate, nights)
  Itinerary (day1~dayN, location, arrival/departure)
  Reservation (동행자, 여권 정보)
  Traveler (korName, engName, passportNo)
         ↓
[고객 로그인] cruiseai.co.kr
  phone + name + 3800
         ↓
[인증 API] /api/auth/login
  onboarded=false → next='/onboarding'
  onboarded=true  → next='/chat'
         ↓
[온보딩 페이지] /onboarding
  GET /api/auth/onboard-data  (APIS 자동 조회)
  → 여행 정보 자동 표시
  → "시작하기" 버튼
         ↓
[완료 API] POST /api/auth/onboard
  onboarded=true 설정
         ↓
[채팅] /chat
```

### DB 링크 방식 (3개 에이전트 공통 결론)

| 데이터 | 연결 방법 | FK |
|--------|-----------|-----|
| UserTrip | `UserTrip.userId = User.id` | ✅ 직접 FK |
| Itinerary | `Itinerary.userTripId = UserTrip.id` | ✅ 직접 FK |
| Reservation | `Reservation.mainUserId = User.id` | ✅ 직접 FK |
| Traveler | `Traveler.reservationId = Reservation.id` | ✅ 직접 FK |
| Traveler → User | `Traveler.userId = User.id` (본인만) | ⚠️ nullable |

> **주의**: UserTrip ↔ Reservation 간 직접 FK 없음. `Reservation.mainUserId = User.id`로 연결.

---

## ✅ Phase 1 구현 완료 (2026-02-26)

### 새로 만든 파일

#### 1. `app/api/auth/onboard-data/route.ts` ✅
```
GET /api/auth/onboard-data
인증: 세션 쿠키 필수

응답:
{
  ok: true,
  user: { id, name, phone },
  trip: {
    id, cruiseName, reservationCode,
    startDate, endDate, nights, days,
    destination, status,
    itinerary: [{ day, date, type, location, country, arrival, departure, isToday }],
    todayItinerary: { day, location, country, type } | null
  } | null,
  travelers: [{ roomNumber, korName, engName, nationality, passportExpiryDate, hasPassport }],
  passportStatus: { isSubmitted, submittedAt, guestCount } | null
}
```

**조회 전략**:
1. 가장 가까운 진행 중 / 예정 UserTrip 우선
2. 없으면 최근 UserTrip 폴백
3. Reservation.mainUserId = user.id로 Traveler 조회
4. PassportSubmission.userId = user.id로 여권 상태 조회

#### 2. `app/api/auth/onboard/route.ts` ✅ (수정)
```
POST /api/auth/onboard
인증: 세션 쿠키 필수
Body: 없음 (name 불필요 — 어드민이 이미 등록)

동작: onboarded=true + onboardingUpdatedAt=now() 설정
```

**변경 전**: name 필드 필수, 이름 업데이트
**변경 후**: 아무 입력 없이 온보딩 완료 처리

#### 3. `app/onboarding/page.tsx` ✅ (전면 재작성)
```
화면 구조:
  [환영 헤더] 이름님 환영합니다 🎉
  [여행 카드] 선사명 / 기간 / 박수 / 예약번호
  [오늘 일정] 오늘 기항지 하이라이트 (노란색)
  [전체 일정] Day1~N 타임라인 (5개 이후 접기/펼치기)
  [동행자] 이름 + 여권 등록 여부
  [여권 상태] 제출 완료/대기
  [시작하기 버튼] → POST /api/auth/onboard → /chat
```

---

## 🚨 발견된 버그 및 리스크 (비즈니스 에이전트 분석)

### ⚠️ 우선순위 1: 재구매 온보딩 (미구현)

**현재 문제**: `User.onboarded`는 단일 Boolean
- 이미 한 번 여행한 고객이 새 여행 구매 → `onboarded=true` 유지
- → 새 여행에 대한 온보딩을 다시 못 봄

**권장 해결책**:
```prisma
// schema.prisma 추가
model User {
  ...
  lastOnboardedTripId  Int?  // 마지막으로 온보딩 완료한 UserTrip.id
}
```

`/api/auth/login`에서:
```typescript
const latestTrip = user.UserTrip[0]; // endDate 내림차순
const needsOnboarding = !existing.onboarded ||
  (latestTrip && existing.lastOnboardedTripId !== latestTrip.id);
next = needsOnboarding ? '/onboarding' : '/chat';
```

**우선순위**: 중간 (Phase 2에서 구현)

### ⚠️ 우선순위 2: UserTrip 등록 전 로그인

**현재 문제**: 어드민이 아직 UserTrip을 안 등록했는데 고객이 먼저 로그인
- → 온보딩 페이지에서 "여행 정보를 찾을 수 없습니다" 표시
- → 현재 구현: `trip = null` → "등록되지 않았어요" + "그냥 시작하기" 버튼

**현재 구현으로 충분**: trip 없어도 시작 가능 ✅
단, 어드민 워크플로우: 반드시 UserTrip 등록 후 고객에게 비밀번호 알려주기

### ⚠️ 우선순위 3: 여러 개의 진행 중 UserTrip

**현재 처리**: `findFirst` + `orderBy: startDate asc` → 가장 가까운 여행 선택
이론적으로는 문제없지만, 실제 운영에서 중복 생성 방지 필요

---

## 🔮 Phase 2 작업 목록

### P2-A: 재구매 온보딩 지원
- [ ] `User` 스키마에 `lastOnboardedTripId Int?` 추가
- [ ] `npx prisma migrate dev --name add_last_onboarded_trip`
- [ ] `/api/auth/login` → 재구매 감지 로직 추가
- [ ] `/api/auth/onboard` → `lastOnboardedTripId` 업데이트

### P2-B: 온보딩 컴포넌트 분리 (선택)
UX 에이전트 제안: 대형 단일 파일 → 컴포넌트 분리
```
app/onboarding/
├── page.tsx
└── components/
    ├── TripSummaryCard.tsx
    ├── ItineraryTimeline.tsx
    ├── TravelerList.tsx
    └── PassportStatus.tsx
```

### P2-C: 일정 접기/펼치기 개선
- 현재: 5개 이후 펼치기 버튼
- 개선: 기항지/항해 구분 탭 필터

### P2-D: 기항지 지도 미리보기
- `Itinerary.portLat/portLng` 활용
- 오늘 기항지 지도 썸네일 표시

---

## 🧪 테스트 계획

### 테스트 계정
```
이름: 김테스트
전화: 01099998888
비밀번호: 3800
여행: 동부지중해 7박8일 (Royal Caribbean Explorer of the Seas)
오늘(Day3): 그리스 카타콜론
```

### 테스트 시나리오

| 시나리오 | 조건 | 예상 결과 |
|---------|------|---------|
| 정상 첫 로그인 | onboarded=false + UserTrip 있음 | 온보딩 페이지 → 여행 정보 표시 |
| UserTrip 없음 | onboarded=false + UserTrip 없음 | 온보딩 페이지 → "등록 안 됨" + 시작 버튼 |
| 재로그인 | onboarded=true | /chat 바로 이동 |
| 서비스 만료 | endDate+1 < now | 로그인 403 (만료 메시지) |
| 1101 체험 비밀번호 | password=1101 | /chat-test 이동 (온보딩 없음) |

### 수동 테스트 URL
```bash
# 로컬 개발 서버
http://localhost:3000/login → 김테스트/01099998888/3800 입력

# 온보딩 데이터 API 직접 확인
curl -H "Cookie: cg.sid.v2=<세션>" http://localhost:3000/api/auth/onboard-data
```

---

## 📌 주요 결정 사항

| 결정 | 이유 |
|------|------|
| No Forms 온보딩 | 구매자 경험 최우선 + APIS 데이터 신뢰 |
| 단일 Neon DB 유지 | 1인팀 운영, DB 분리는 비용/복잡도 3배 증가 |
| 캐싱 없음 | 온보딩은 1회성 이벤트, 캐시 불필요 |
| trip=null 허용 | 어드민 등록 지연 케이스 대응 |
| onboard API에 name 불필요 | 어드민이 이미 등록함 |

---

**작성**: Claude Sonnet 4.6 (3개 병렬 서브에이전트 토론 결과 통합)
**검토**: DB 아키텍트 에이전트, UX 에이전트, 비즈니스/버그 분석 에이전트
