// app/profile-test/page.tsx
import prisma from '@/lib/prisma';
import { getServerSession } from '@/app/(server)/session';
import Link from 'next/link';
import { formatDateK } from '@/lib/utils';
import { getDdayMessage } from '@/lib/date-utils';
import ddayMessages from '@/data/dday_messages.json';
import TTSToggle from './components/TTSToggle';
import PushToggle from './components/PushToggle';
import TripInfoSection from './components/TripInfoSection';
import ProfileTestWrapper from './ProfileTestWrapper';
import { FiArrowLeft, FiUser } from 'react-icons/fi';
import { checkTestMode, getCorrectPath } from '@/lib/test-mode';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  // 경로 보호: 일반 사용자는 /profile로 리다이렉트
  const testModeInfo = await checkTestMode();
  const correctPath = getCorrectPath('/profile-test', testModeInfo);
  
  if (correctPath !== '/profile-test') {
    redirect(correctPath);
  }
  
  // 1) 세션 (❗️중요: await 필수)
  const session = await getServerSession();


  // 2) 유저/여행 조회 (세션 없으면 조회 생략)
  let user: { id: number; name?: string | null; phone?: string | null } | null = null;
  let trip:
    | {
        id: number;
        cruiseName?: string | null;
        destination?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        userId: number;
        nights?: number | null;
        days?: number | null;
        companionType?: string | null;
      }
    | null = null;

  if (session?.userId) {
    const userId = session.userId;

    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true },
    });


    // 유저 정보가 성공적으로 조회되면 여행 정보 조회 (브리핑 API와 동일한 방식)
    if (user) {
      trip = await prisma.userTrip.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          cruiseName: true,
          destination: true,
          startDate: true,
          endDate: true,
          nights: true,
          days: true,
          companionType: true,
          userId: true,
        },
      });

    }
  }

  // 3) D-day 메시지 (유저/여행 정보 있으면 조회)
  let dday: string | null = null;
  let isTripExpired = false;
  let currentDday: number | null = null;
  let ddayType: 'departure' | 'return' = 'departure';

  if (user && trip?.startDate && trip?.endDate) {
    dday = getDdayMessage(trip.startDate, trip.endDate, user.phone);
    
    const endDate = new Date(trip.endDate);
    const gracePeriodEnd = new Date(endDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 1);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (now > gracePeriodEnd) {
      isTripExpired = true;
    } else {
      const startDate = new Date(trip.startDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      // 항상 출발일 기준으로 D-day 계산 (briefing API와 동일)
      if (now < startDate) {
        // 여행 시작 전: 출발일까지 D-day
        const diffTime = startDate.getTime() - now.getTime();
        currentDday = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        ddayType = 'departure';
      } else if (now >= startDate && now <= endDate) {
        // 여행 중: 출발일 기준으로 음수 D-day (이미 출발했으므로)
        const diffTime = now.getTime() - startDate.getTime();
        currentDday = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        ddayType = 'departure'; // 여전히 출발 기준
      } else {
        // 여행 종료 후: 출발일 기준으로 음수 D-day
        const diffTime = now.getTime() - startDate.getTime();
        currentDday = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        ddayType = 'departure';
      }
    }
    
  }

  // 4) 여행 기간 계산
  let tripDuration = '정보 없음';
  if (trip && trip.nights !== null && trip.days !== null) {
    tripDuration = `${trip.nights}박 ${trip.days}일`;
  } else if (trip?.startDate && trip?.endDate) {
    const startDate = new Date(trip.startDate);
    const endDate = new Date(trip.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const nights = diffDays - 1;
    tripDuration = `${nights}박 ${diffDays}일`;
  }

  // 5) 동반자 정보
  let companionType = '정보 없음';
  if (trip && trip.companionType) {
    const typeMap: Record<string, string> = {
      'solo': '1명 (혼자)',
      'couple': '2명 (부부/연인)',
      'family': '가족',
      'friends': '친구',
      'group': '단체',
    };
    companionType = typeMap[trip.companionType] || '정보 없음';
  }

  // HTML 이스케이프 (dangerouslySetInnerHTML XSS 방지)
  const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // 6) 목적지 문자열 변환
  let destinationString = '정보 없음';
  if (trip?.destination) {
    const dest: any = trip.destination;
    if (typeof dest === 'string') {
      try {
        const parsed = JSON.parse(dest);
        if (Array.isArray(parsed)) {
          destinationString = parsed.join(', ');
        } else {
          destinationString = dest;
        }
      } catch {
        destinationString = dest;
      }
    } else if (Array.isArray(dest)) {
      destinationString = dest.join(', ');
    } else {
      destinationString = String(dest);
    }
  }

  return (
    <ProfileTestWrapper>
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* 헤더 */}
          <div className="mb-8">
            <Link
              href="/tools-test"
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-4 transition-colors"
            >
              <FiArrowLeft size={20} />
              <span className="text-base font-medium">뒤로가기</span>
            </Link>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-5 shadow-xl">
                <FiUser size={48} className="text-white md:w-12 md:h-12" />
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent mb-4 leading-tight">
                👤 내 정보
              </h1>
              <p className="text-lg md:text-xl text-gray-700 font-medium leading-relaxed">
                나의 여행 정보와 설정을 확인하세요
              </p>
              <p className="text-base md:text-lg text-gray-600 mt-3 leading-relaxed">
                72시간 동안 모든 기능을 무료로 체험해보세요!
              </p>
            </div>
          </div>

          {/* 튜토리얼 가이드 섹션 */}
          <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-2 border-purple-300 rounded-2xl p-6 md:p-8 shadow-lg mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-5 flex items-center gap-3 leading-tight">
              <span className="text-4xl md:text-5xl">💡</span>
              내 정보 활용 가이드
            </h2>
            <div className="space-y-5">
              <div className="bg-white/80 rounded-lg p-5 md:p-6 border-2 border-blue-200">
                <h3 className="font-bold text-blue-700 text-xl md:text-2xl mb-3 flex items-center gap-3 leading-tight">
                  <span className="text-3xl md:text-4xl">🚢</span>
                  나의 여행
                </h3>
                <p className="text-base md:text-lg text-gray-700 mb-3 leading-relaxed">
                  등록된 크루즈 여행 정보를 확인하고 동반자 정보를 수정할 수 있습니다.
                </p>
                <ul className="space-y-2 text-base md:text-lg text-gray-600 leading-relaxed">
                  <li>• 크루즈명, 여행지, 기간, 여행일정 확인</li>
                  <li>• 동반자 정보 수정 가능</li>
                  <li>• 여행 지도 보기</li>
                </ul>
              </div>
              
              <div className="bg-white/80 rounded-lg p-5 md:p-6 border-2 border-purple-200">
                <h3 className="font-bold text-purple-700 text-xl md:text-2xl mb-3 flex items-center gap-3 leading-tight">
                  <span className="text-3xl md:text-4xl">✨</span>
                  크루즈닷의 여행 준비 가이드
                </h3>
                <p className="text-base md:text-lg text-gray-700 mb-3 leading-relaxed">
                  D-day에 맞춰 단계별로 여행 준비를 도와드립니다.
                </p>
                <ul className="space-y-2 text-base md:text-lg text-gray-600 leading-relaxed">
                  <li>• 현재 D-day에 맞는 준비 가이드 확인</li>
                  <li>• 앞으로 봐야 할 메시지와 이미 본 메시지 구분</li>
                  <li>• 중요한 준비물 강조 표시</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 로그인 체크 */}
          {!session?.userId ? (
            <section className="bg-white rounded-2xl shadow-xl p-8 text-center border-2 border-purple-200">
              <p className="text-xl text-gray-700 mb-6">로그인 후 이용 가능합니다.</p>
              <Link
                className="inline-block px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105"
                href="/login-test?next=/profile-test"
              >
                로그인하기
              </Link>
            </section>
          ) : (
            <>
              {/* 로그인 했고 유저/여행 정보 있음 */}
              {user && trip ? (
                <div className="space-y-6">
                  {/* 내 정보 섹션 */}
                  <section className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-purple-200">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-5 flex items-center gap-3 leading-tight">
                      <span className="text-4xl md:text-5xl">👤</span>
                      내 정보
                    </h2>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 md:p-5 bg-gray-50 rounded-lg">
                        <span className="text-gray-600 font-semibold text-base md:text-lg min-w-[100px]">이름:</span>
                        <span className="font-bold text-gray-900 text-base md:text-lg">{user.name ?? '정보 없음'}</span>
                      </div>
                      <div className="flex items-center gap-4 p-4 md:p-5 bg-gray-50 rounded-lg">
                        <span className="text-gray-600 font-semibold text-base md:text-lg min-w-[100px]">연락처:</span>
                        <span className="font-bold text-gray-900 text-base md:text-lg break-all">{user.phone ?? '정보 없음'}</span>
                      </div>
                    </div>
                  </section>

                  {/* 설정 섹션 */}
                  <section className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-blue-200">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-5 flex items-center gap-3 leading-tight">
                      <span className="text-4xl md:text-5xl">⚙️</span>
                      설정
                    </h2>
                    <div className="space-y-5">
                      <TTSToggle />
                      <PushToggle />
                    </div>
                  </section>

                  {/* 나의 여행 섹션 */}
                  <TripInfoSection
                    trip={trip}
                    companionType={companionType}
                    tripDuration={tripDuration}
                    destinationString={destinationString}
                  />

                  {/* 여행 종료 상태가 아닐 때만 D-Day 정보 표시 */}
                  {!isTripExpired ? (
                    <>
                      {/* 크루즈닷의 여행 준비 가이드 */}
                      <section className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-purple-200">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-center text-gray-900 mb-8 flex items-center justify-center gap-3 leading-tight">
                          <span className="text-5xl md:text-6xl">✨</span>
                          크루즈닷의 여행 준비 가이드
                          <span className="text-5xl md:text-6xl">✨</span>
                        </h2>
                        
                        {/* 현재 D-day에 맞는 메시지 표시 */}
                        {(() => {
                          let pastKey: string | null = null;
                          let currentKey: string | null = null;
                          let futureKey: string | null = null;
                          
                          if (currentDday !== null) {
                            if (ddayType === 'departure') {
                              const validDdays = [0, 1, 2, 3, 7, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                              
                              // 현재 D-day가 양수인 경우 (여행 시작 전)
                              if (currentDday >= 0) {
                                let currentDdayKey: string | null = null;
                                
                                // 현재 D-day가 validDdays에 정확히 있는지 확인
                                if (validDdays.includes(currentDday)) {
                                  currentDdayKey = String(currentDday);
                                } else {
                                  // 가장 가까운 다음 D-day 찾기
                                  const nextDday = validDdays.find(d => d >= currentDday);
                                  if (nextDday !== undefined) {
                                    currentDdayKey = String(nextDday);
                                  }
                                }
                                
                                if (currentDdayKey) {
                                  currentKey = currentDdayKey;
                                  const currentNum = parseInt(currentDdayKey);
                                  
                                  // 앞으로 봐야 할 메시지: 현재보다 작은 D-day (숫자가 적어지는 방향)
                                  const futureDdays = validDdays.filter(d => d < currentNum).reverse();
                                  for (const futureDday of futureDdays) {
                                    if (ddayMessages.messages[String(futureDday)]) {
                                      futureKey = String(futureDday);
                                      break;
                                    }
                                  }
                                  
                                  // 이미 봤던 메시지: 현재보다 큰 D-day (숫자가 많아지는 방향)
                                  const pastDday = validDdays.find(d => d > currentNum);
                                  if (pastDday !== undefined && ddayMessages.messages[String(pastDday)]) {
                                    pastKey = String(pastDday);
                                  }
                                }
                              } else {
                                // 여행 중이거나 종료된 경우 (음수 D-day)
                                // D-0 메시지를 표시하거나, 가장 최근 메시지 표시
                                if (ddayMessages.messages['0']) {
                                  currentKey = '0';
                                } else if (ddayMessages.messages['1']) {
                                  currentKey = '1';
                                } else if (ddayMessages.messages['2']) {
                                  currentKey = '2';
                                } else if (ddayMessages.messages['3']) {
                                  currentKey = '3';
                                }
                              }
                            } else {
                              if (currentDday === 1) {
                                currentKey = 'end_1';
                                if (ddayMessages.messages['end_0']) {
                                  futureKey = 'end_0';
                                }
                                const validDdays = [0, 1, 2, 3, 7, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                                const pastDdays = validDdays.filter(d => d <= 10).reverse();
                                for (const pastDday of pastDdays) {
                                  if (ddayMessages.messages[String(pastDday)]) {
                                    pastKey = String(pastDday);
                                    break;
                                  }
                                }
                              } else if (currentDday === 0) {
                                currentKey = 'end_0';
                                if (ddayMessages.messages['end_1']) {
                                  pastKey = 'end_1';
                                }
                              }
                            }
                          }
                          
                          // 메시지가 없으면 기본 메시지 표시
                          if (!currentKey && ddayMessages.messages['7']) {
                            currentKey = '7';
                          }
                          
                          const renderOrder = [futureKey, currentKey, pastKey].filter((k): k is string => k !== null);
                          
                          return (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8">
                              {renderOrder.map((key) => {
                                const message = ddayMessages.messages[key];
                                if (!message) return null;
                                
                                const isCurrent = key === currentKey;
                                const isFuture = key === futureKey;
                                const isPast = key === pastKey;
                                
                                const getCardStyle = () => {
                                  if (key === 'end_1' || key === 'end_0') {
                                    return isCurrent 
                                      ? 'bg-white border-2 border-purple-300 shadow-lg relative transform scale-105'
                                      : 'bg-white border border-gray-200 shadow-md';
                                  }
                                  if (isCurrent) {
                                    return 'bg-white border-2 border-blue-400 shadow-lg relative transform scale-105';
                                  }
                                  if (isFuture) {
                                    return 'bg-white border border-gray-200 shadow-md';
                                  }
                                  return 'bg-gray-50 border border-gray-200 shadow-sm';
                                };
                                
                                const getDdayLabel = () => {
                                  if (key === 'end_1') return 'D-1(귀국)';
                                  if (key === 'end_0') return 'D-0(귀국일)';
                                  return `D-${key}`;
                                };
                                
                                const getLabel = () => {
                                  if (isCurrent) return '지금 봐야 할 메시지';
                                  if (isFuture) return '앞으로 봐야 할 메시지';
                                  if (isPast) return '이미 봤던 메시지';
                                  return '';
                                };
                                
                                return (
                                  <div key={key} className={`${getCardStyle()} rounded-xl p-6 md:p-8`}>
                                    <div className="mb-4">
                                      <span className={`text-sm md:text-base px-4 py-2 rounded-full font-semibold ${
                                        isCurrent 
                                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' 
                                          : isFuture
                                          ? 'bg-yellow-50 text-yellow-700 border-2 border-yellow-200'
                                          : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                                      }`}>
                                        {getLabel()}
                                      </span>
                                    </div>
                                    
                                    {isCurrent && (
                                      <div className="flex items-center justify-center mb-5">
                                        <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-100 rounded-full flex items-center justify-center border-2 border-blue-300">
                                          <span className="text-3xl md:text-4xl text-blue-600">✓</span>
                                        </div>
                                      </div>
                                    )}
                                    {!isCurrent && (
                                      <div className="flex items-center justify-center mb-5">
                                        <div className="text-5xl md:text-6xl text-gray-300">{isFuture ? '⏩' : '✓'}</div>
                                      </div>
                                    )}
                                    <div className={`${
                                      isCurrent 
                                        ? 'bg-blue-50 border-2 border-blue-200' 
                                        : isFuture
                                        ? 'bg-yellow-50 border-2 border-yellow-200'
                                        : 'bg-gray-50 border-2 border-gray-200'
                                    } rounded-lg px-5 py-4 text-center mb-5`}>
                                      <span className={`font-bold text-2xl md:text-3xl ${
                                        isCurrent ? 'text-blue-700' : isFuture ? 'text-yellow-700' : 'text-gray-600'
                                      }`}>{getDdayLabel()}</span>
                                    </div>
                                    <h3 className="font-bold text-xl md:text-2xl mb-5 leading-tight text-gray-900 break-words">
                                      {message.title.replace(/^D-\d+:\s*/, '').replace(/^D-\d+\(귀국\):\s*/, '').replace(/^귀국일:\s*/, '')}
                                    </h3>
                                    <div 
                                      className="text-base md:text-lg text-gray-700 leading-relaxed [&>span]:bg-yellow-200 [&>span]:text-gray-900 [&>span]:px-2 [&>span]:py-0.5 [&>span]:rounded [&>span]:font-semibold break-words"
                                      style={{ lineHeight: '1.8', fontSize: '18px' }}
                                      dangerouslySetInnerHTML={{ 
                                        __html: message.message
                                          .replace(/\[고객명\]/g, `<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">${escHtml(user.name || '고객')}</span>`)
                                          .replace(/\[크루즈명\]/g, escHtml(trip.cruiseName || '크루즈'))
                                          .replace(/\[목적지\]/g, escHtml(destinationString))
                                          .replace(/(승선권)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                          .replace(/(여권\(유효기간 6개월 이상\))/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                          .replace(/(여권)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                          .replace(/(해외 결제 가능 신용카드)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                          .replace(/(신용카드)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                          .replace(/(국제 운전면허)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                          .replace(/(텀블러\(선내에서 유용\))/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                          .replace(/(상비약)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                          .replace(/(개인 처방약)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                          .replace(/\n/g, '<br/>')
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* 안내 문구 */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 mb-6">
                          <p className="text-center text-gray-800 font-semibold text-lg flex items-center justify-center gap-3">
                            <span className="text-3xl">💡</span>
                            <span className="bg-yellow-200 text-gray-900 px-3 py-1.5 rounded-md font-semibold">{user.name || '고객'}</span>님의 완벽한 크루즈 여행을 위한 단계별 가이드입니다
                          </p>
                        </div>

                        {/* D-Day 상세 정보 */}
                        {trip?.startDate && trip?.endDate && currentDday !== null && (() => {
                          let detailMessageKey: string | null = null;
                          
                          if (ddayType === 'departure') {
                            const validDdays = [0, 1, 2, 3, 7, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                            
                            // 현재 D-day가 양수인 경우 (여행 시작 전)
                            if (currentDday >= 0) {
                              if (validDdays.includes(currentDday)) {
                                detailMessageKey = String(currentDday);
                              } else {
                                const nextDday = validDdays.find(d => d >= currentDday);
                                if (nextDday !== undefined) {
                                  detailMessageKey = String(nextDday);
                                } else {
                                  detailMessageKey = '7'; // 기본값
                                }
                              }
                            } else {
                              // 여행 중이거나 종료된 경우 (음수 D-day)
                              detailMessageKey = '0'; // D-0 메시지 표시
                            }
                          } else {
                            if (currentDday === 1) {
                              detailMessageKey = 'end_1';
                            } else if (currentDday === 0) {
                              detailMessageKey = 'end_0';
                            }
                          }
                          
                          const detailMessage = detailMessageKey ? ddayMessages.messages[detailMessageKey] : null;
                          
                          if (!detailMessage) return null;
                          
                          return (
                            <section className="mt-4 rounded-xl border bg-white p-4">
                              <h2 className="text-base font-semibold text-gray-800">D-Day ({dday ?? '정보 없음'})</h2>
                              <p className="mt-2 text-gray-600">📅 출발 {formatDateK(trip.startDate)} · 도착 {formatDateK(trip.endDate)}</p>
                              <div className="mt-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                                <h3 className="font-bold text-gray-900 mb-4 text-lg md:text-xl">{detailMessage.title}</h3>
                                <div 
                                  className="text-base md:text-lg text-gray-700 leading-relaxed [&>span]:bg-yellow-200 [&>span]:text-gray-900 [&>span]:px-2 [&>span]:py-0.5 [&>span]:rounded [&>span]:font-semibold"
                                  style={{ lineHeight: '1.8' }}
                                  dangerouslySetInnerHTML={{ 
                                    __html: detailMessage.message
                                      .replace(/\[고객명\]/g, `<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">${escHtml(user.name || '고객')}</span>`)
                                      .replace(/\[크루즈명\]/g, escHtml(trip.cruiseName || '크루즈'))
                                      .replace(/\[목적지\]/g, escHtml(destinationString))
                                      .replace(/(여권\(유효기간 6개월 이상\))/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                      .replace(/(해외 결제 가능 신용카드)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                      .replace(/(텀블러\(선내에서 유용\))/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                      .replace(/(상비약)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                      .replace(/(개인 처방약)/g, '<span class="bg-yellow-200 text-gray-900 px-2 py-0.5 rounded font-semibold">$1</span>')
                                      .replace(/\n/g, '<br/>')
                                  }}
                                />
                              </div>
                            </section>
                          );
                        })()}
                      </section>
                    </>
                  ) : (
                    <section className="bg-white rounded-2xl shadow-xl p-8 text-center border-2 border-purple-200">
                      <h2 className="text-xl font-semibold text-gray-800">여행이 종료되었습니다</h2>
                      <p className="mt-2 text-gray-600">
                        여행이 종료되어 D-Day 준비 가이드를 더 이상 표시하지 않습니다.
                      </p>
                      <Link
                        href="https://cruisedot.kr"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700"
                      >
                        다음 여행 등록하기
                      </Link>
                    </section>
                  )}
                </div>
              ) : (
                <section className="bg-white rounded-2xl shadow-xl p-8 text-center border-2 border-purple-200">
                  <div className="text-6xl mb-4">🚢</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">아직 여행 정보가 없습니다</h2>
                  <p className="text-gray-600 mb-6">새로운 여행을 시작해보세요!</p>
                  <Link
                    className="inline-block px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105"
                    href="/chat-test"
                  >
                    새 여행 시작하기
                  </Link>
                </section>
              )}
            </>
          )}

          {/* CTA 섹션 */}
          <div className="mt-8">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl p-8 text-center shadow-2xl">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                🎉 크루즈닷AI와 함께 완벽한 여행을 준비하세요!
              </h3>
              <p className="text-white/90 text-lg mb-6">
                72시간 무료 체험으로 모든 기능을 경험해보세요
              </p>
              <Link
                href="/chat-test"
                className="inline-block px-8 py-4 bg-white text-purple-600 font-bold rounded-xl shadow-lg hover:bg-gray-100 transition-all transform hover:scale-105"
              >
                크루즈닷과 대화하기 →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </ProfileTestWrapper>
  );
}
