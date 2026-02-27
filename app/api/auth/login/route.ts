export const dynamic = 'force-dynamic';


import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';                // ✅ default import (중요)
import { cookies, headers } from 'next/headers';
import { randomBytes } from 'crypto';
import { generateCsrfToken } from '@/lib/csrf';
import { checkRateLimit, RateLimitPolicies } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/ip-utils';
import { authLogger, securityLogger, logger } from '@/lib/logger';
import { reactivateUser, updateLastActive } from '@/lib/scheduler/lifecycleManager';
import { normalizeItineraryPattern, extractVisitedCountriesFromItineraryPattern, extractDestinationsFromItineraryPattern } from '@/lib/utils/itineraryPattern';

const SESSION_COOKIE = 'cg.sid.v2';
const TEST_MODE_PASSWORDS = ['1101']; // 테스트 모드는 1101만 허용

export async function POST(req: Request) {
  try {
    // Rate Limiting 체크
    const headersList = await headers();
    const clientIp = getClientIpFromRequest(req, headersList);
    const rateLimitKey = `login:${clientIp}`;

    const { limited, resetTime } = checkRateLimit(rateLimitKey, RateLimitPolicies.LOGIN);

    if (limited) {
      securityLogger.rateLimitExceeded(clientIp, '/api/auth/login', RateLimitPolicies.LOGIN.limit);
      const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60;
      return NextResponse.json(
        {
          ok: false,
          error: '너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.',
          retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
          }
        }
      );
    }

    let { phone, password, name, mode, trialCode, affiliateCode } = await req.json();

    // 입력값 앞뒤 공백 제거
    phone = phone?.trim() || '';
    password = password?.trim() || '';
    name = name?.trim() || '';

    logger.log('[Login API] 요청 받음:', { phone: phone ? `${phone.substring(0, 3)}***` : 'empty', password: password ? '***' : 'empty', name: name ? `${name.substring(0, 1)}***` : 'empty', mode });

    const isPartnerLogin = mode === 'partner' || password === 'qwe1';

    logger.log('[Login API] 파트너 로그인 여부:', { isPartnerLogin, mode, passwordIsQwe1: password === 'qwe1' });

    if (isPartnerLogin) {
      const identifier = phone?.trim() || '';
      if (!identifier) {
        return NextResponse.json(
          { ok: false, error: '아이디 또는 전화번호를 입력해주세요.' },
          { status: 400 },
        );
      }

      // 대소문자 구분 없이 검색하기 위해 소문자로 변환
      const identifierLower = identifier.toLowerCase();
      const digitsOnly = identifier.replace(/[^0-9]/g, '');

      console.log('[Partner Login] 로그인 시도:', { identifier, identifierLower, password: '***', mode });

      // 파트너 로그인: 속도 최적화 - 정확한 일치 먼저 시도, 없으면 확장 검색
      // AffiliateProfile도 함께 조회하여 추가 쿼리 제거
      let affiliateUser = await prisma.user.findFirst({
        where: {
          OR: [
            { mallUserId: identifierLower },
            { phone: identifierLower },
            ...(digitsOnly && digitsOnly !== identifierLower ? [{ phone: digitsOnly }] : []),
          ],
        },
        select: {
          id: true,
          mallUserId: true,
          mallNickname: true,
          phone: true,
          password: true,
          loginCount: true,
          role: true,
          AffiliateProfile: {
            select: { id: true, type: true, status: true },
          },
        },
      });

      console.log('[Partner Login] 사용자 검색 결과:', affiliateUser ? {
        id: affiliateUser.id,
        mallUserId: affiliateUser.mallUserId,
        phone: affiliateUser.phone,
        role: affiliateUser.role,
        hasPassword: !!affiliateUser.password,
      } : '사용자를 찾을 수 없음');

      // 계정이 없고 기본 비밀번호(1101, qwe1, zxc1)를 사용하는 경우 자동 생성
      if (!affiliateUser && (password === '1101' || password === 'qwe1' || password === 'zxc1')) {
        console.log('[Partner Login] 파트너 계정 자동 생성:', { identifier, identifierLower });
        const isBoss = identifierLower.startsWith('boss');
        const isGest = identifierLower.startsWith('gest'); // gest 계정 여부 확인
        const newMallUserId = identifierLower;

        // phone 필드도 설정 (mallUserId와 동일하게)
        try {
          const now = new Date();
          affiliateUser = await prisma.user.create({
            data: {
              mallUserId: newMallUserId,
              phone: newMallUserId,
              password: password,
              name: isGest ? '정액제 판매원' : (isBoss ? '대리점장' : '판매원'),
              role: 'user',
              loginCount: 1,
              customerStatus: 'active',
              customerSource: 'partner-test',
              updatedAt: now,
            },
            select: {
              id: true,
              mallUserId: true,
              mallNickname: true,
              phone: true,
              password: true,
              loginCount: true,
              role: true,
              AffiliateProfile: {
                select: { id: true, type: true, status: true },
              },
            },
          });
          console.log('[Partner Login] 파트너 계정 생성 완료:', { userId: affiliateUser.id, mallUserId: affiliateUser.mallUserId });
        } catch (createError: any) {
          console.error('[Partner Login] 계정 생성 실패:', createError);
          // 중복 키 에러인 경우 다시 조회 시도
          if (createError?.code === 'P2002') {
            affiliateUser = await prisma.user.findFirst({
              where: {
                OR: [
                  { mallUserId: newMallUserId },
                  { phone: newMallUserId },
                ],
              },
              select: {
                id: true,
                mallUserId: true,
                mallNickname: true,
                phone: true,
                password: true,
                loginCount: true,
                role: true,
                AffiliateProfile: {
                  select: { id: true, type: true, status: true },
                },
              },
            });
            console.log('[Partner Login] 중복 계정 발견, 재조회 완료:', { userId: affiliateUser?.id, mallUserId: affiliateUser?.mallUserId });
          } else {
            throw createError;
          }
        }
      }

      if (!affiliateUser) {
        return NextResponse.json(
          { ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
          { status: 401 },
        );
      }

      const storedPassword = affiliateUser.password ?? '';
      let isPasswordValid = false;

      // 파트너 기본 비밀번호 우선 체크 (1101, qwe1, zxc1)
      // 파트너 로그인일 때는 기본 비밀번호를 무조건 허용
      if (password === '1101' || password === 'qwe1' || password === 'zxc1') {
        // 파트너 기본 비밀번호는 무조건 허용
        isPasswordValid = true;
        console.log('[Partner Login] 파트너 기본 비밀번호 허용:', { phone: identifier, password });
      } else {
        // 일반 비밀번호 검증
        if (storedPassword.startsWith('$2')) {
          try {
            const bcrypt = await import('bcryptjs');
            isPasswordValid = await bcrypt.default.compare(password, storedPassword);
            console.log('[Partner Login] bcrypt 비교 결과:', { phone: identifier, isValid: isPasswordValid });
          } catch (compareError) {
            console.warn('[Partner Login] bcrypt 비교 중 오류:', compareError);
            isPasswordValid = false;
          }
        } else if (storedPassword.length > 0) {
          isPasswordValid = storedPassword === password;
          console.log('[Partner Login] 평문 비밀번호 비교 결과:', { phone: identifier, isValid: isPasswordValid });
        }
      }

      if (!isPasswordValid) {
        return NextResponse.json(
          { ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
          { status: 401 },
        );
      }

      // mallUserId가 없으면 identifier로 설정
      if (!affiliateUser.mallUserId) {
        await prisma.user.update({
          where: { id: affiliateUser.id },
          data: { mallUserId: identifier.toLowerCase() },
        });
        affiliateUser.mallUserId = identifier.toLowerCase();
      }

      // 이미 사용자 조회 시 AffiliateProfile을 함께 가져왔으므로 추가 쿼리 불필요
      // 1:1 관계이므로 배열이 아닌 객체로 접근
      let affiliateProfile = affiliateUser.AffiliateProfile;

      // status가 ACTIVE인 경우만 유효한 프로필로 간주
      if (affiliateProfile && affiliateProfile.status !== 'ACTIVE') {
        affiliateProfile = null;
      }

      if (!affiliateProfile) {
        // phone 필드가 boss로 시작하면 대리점장, gest로 시작하면 정액제 판매원
        const isBoss = affiliateUser.phone?.toLowerCase().startsWith('boss') || affiliateUser.mallUserId?.toLowerCase().startsWith('boss');
        const isGest = affiliateUser.phone?.toLowerCase().startsWith('gest') || affiliateUser.mallUserId?.toLowerCase().startsWith('gest');
        const affiliateCode = `AFF-${(affiliateUser.mallUserId || identifierLower).toUpperCase()}-${randomBytes(2)
          .toString('hex')
          .toUpperCase()}`;

        console.log('[Partner Login] AffiliateProfile 생성 시도:', {
          userId: affiliateUser.id,
          mallUserId: affiliateUser.mallUserId,
          phone: affiliateUser.phone,
          isBoss,
          isGest,
          type: isBoss ? 'BRANCH_MANAGER' : 'SALES_AGENT'
        });

        try {
          const now = new Date();
          affiliateProfile = await prisma.affiliateProfile.create({
            data: {
              userId: affiliateUser.id,
              affiliateCode,
              type: isBoss ? 'BRANCH_MANAGER' : 'SALES_AGENT',
              status: 'ACTIVE',
              displayName: affiliateUser.mallNickname || affiliateUser.mallUserId || '파트너',
              nickname: affiliateUser.mallNickname || affiliateUser.mallUserId || '파트너',
              branchLabel: null,
              landingSlug: affiliateUser.mallUserId || identifierLower || undefined,
              landingAnnouncement: '파트너 전용 샘플 계정입니다.',
              welcomeMessage: '반갑습니다! 파트너몰 테스트 계정입니다.',
              updatedAt: now,
            },
            select: { id: true },
          });
          console.log('[Partner Login] AffiliateProfile 생성 완료:', { profileId: affiliateProfile.id });

          // gest 계정인 경우 정액제 계약서 자동 생성 (7일 무료 체험)
          if (isGest && affiliateUser) {
            try {
              const trialEndDate = new Date();
              trialEndDate.setDate(trialEndDate.getDate() + 7); // 7일 무료 체험

              const contractEndDate = new Date();
              contractEndDate.setDate(contractEndDate.getDate() + 7); // 초기 계약 종료일도 7일 후

              await prisma.affiliateContract.create({
                data: {
                  userId: affiliateUser.id,
                  name: affiliateUser.name || '정액제 판매원',
                  residentId: '000000-0000000', // 임시 주민등록번호
                  phone: affiliateUser.phone || '000-0000-0000',
                  email: `${affiliateUser.mallUserId}@example.com`,
                  address: '테스트 주소',
                  status: 'completed', // gest1은 완료 상태로 시작
                  metadata: {
                    contractType: 'SUBSCRIPTION_AGENT',
                    isTrial: true,
                    trialEndDate: trialEndDate.toISOString(),
                  },
                  contractStartDate: now,
                  contractEndDate: contractEndDate,
                  submittedAt: now,
                  updatedAt: now,
                },
              });
              console.log('[Partner Login] Gest 계정 정액제 계약서 자동 생성 완료:', { userId: affiliateUser.id });
            } catch (contractError: any) {
              console.error('[Partner Login] Gest 계정 정액제 계약서 생성 실패:', contractError);
              // 계약서 생성 실패해도 로그인은 계속 진행
            }
          }
        } catch (profileError: any) {
          console.error('[Partner Login] AffiliateProfile 생성 실패:', profileError);
          // 중복 키 에러인 경우 다시 조회
          if (profileError?.code === 'P2002') {
            affiliateProfile = await prisma.affiliateProfile.findFirst({
              where: { userId: affiliateUser.id },
              select: { id: true },
            });
            console.log('[Partner Login] 중복 AffiliateProfile 발견, 재조회 완료:', { profileId: affiliateProfile?.id });
          } else {
            // AffiliateProfile 생성 실패 시 로그인도 실패
            console.error('[Partner Login] AffiliateProfile 생성 실패로 로그인 중단:', profileError);
            return NextResponse.json(
              { ok: false, error: '파트너 프로필 생성에 실패했습니다. 관리자에게 문의해주세요.', details: profileError?.message },
              { status: 500 }
            );
          }
        }

        // AffiliateProfile이 여전히 없으면 로그인 실패
        if (!affiliateProfile) {
          console.error('[Partner Login] AffiliateProfile이 없어서 로그인 실패');
          return NextResponse.json(
            { ok: false, error: '파트너 프로필을 찾을 수 없습니다. 관리자에게 문의해주세요.' },
            { status: 500 }
          );
        }
      }

      // gest 계정인 경우 정액제 계약서 확인 및 자동 생성/리셋 (기존 계정도 포함)
      if (affiliateUser && affiliateProfile) {
        const isGest = affiliateUser.phone?.toLowerCase().startsWith('gest') || affiliateUser.mallUserId?.toLowerCase().startsWith('gest');
        const isGest1 = (affiliateUser.phone?.toLowerCase() === 'gest1' || affiliateUser.mallUserId?.toLowerCase() === 'gest1');

        if (isGest) {
          try {
            // 기존 정액제 계약서 확인
            const existingContract = await prisma.affiliateContract.findFirst({
              where: {
                userId: affiliateUser.id,
                metadata: {
                  path: ['contractType'],
                  equals: 'SUBSCRIPTION_AGENT',
                },
              },
            });

            const now = new Date();

            // gest1은 테스트용이므로 로그인할 때마다 무료 체험 리셋
            if (isGest1 && existingContract) {
              const trialEndDate = new Date();
              trialEndDate.setDate(trialEndDate.getDate() + 7); // 7일 무료 체험

              const contractEndDate = new Date();
              contractEndDate.setDate(contractEndDate.getDate() + 7);

              // 기존 계약서 업데이트 (무료 체험 리셋)
              await prisma.affiliateContract.update({
                where: { id: existingContract.id },
                data: {
                  status: 'completed',
                  metadata: {
                    contractType: 'SUBSCRIPTION_AGENT',
                    isTrial: true,
                    trialEndDate: trialEndDate.toISOString(),
                  },
                  contractStartDate: now,
                  contractEndDate: contractEndDate,
                  updatedAt: now,
                },
              });
              console.log('[Partner Login] Gest1 계정 무료 체험 리셋 완료:', { userId: affiliateUser.id, contractId: existingContract.id });
            } else if (!existingContract) {
              // 정액제 계약서가 없으면 생성
              const trialEndDate = new Date();
              trialEndDate.setDate(trialEndDate.getDate() + 7); // 7일 무료 체험

              const contractEndDate = new Date();
              contractEndDate.setDate(contractEndDate.getDate() + 7);

              await prisma.affiliateContract.create({
                data: {
                  userId: affiliateUser.id,
                  name: affiliateUser.name || '정액제 판매원',
                  residentId: '000000-0000000',
                  phone: affiliateUser.phone || '000-0000-0000',
                  email: `${affiliateUser.mallUserId}@example.com`,
                  address: '테스트 주소',
                  status: 'completed', // gest 계정은 완료 상태로 시작
                  metadata: {
                    contractType: 'SUBSCRIPTION_AGENT',
                    isTrial: true,
                    trialEndDate: trialEndDate.toISOString(),
                  },
                  contractStartDate: now,
                  contractEndDate: contractEndDate,
                  submittedAt: now,
                  updatedAt: now,
                },
              });
              console.log('[Partner Login] 기존 Gest 계정 정액제 계약서 자동 생성 완료:', { userId: affiliateUser.id });
            }
          } catch (contractError: any) {
            console.error('[Partner Login] Gest 계정 정액제 계약서 확인/생성 실패:', contractError);
            // 계약서 생성 실패해도 로그인은 계속 진행
          }
        }
      }

      // 기존 세션 정리 (동시 로그인 방지 및 세션 테이블 정리) -> 다중 세션 허용을 위해 주석 처리
      /*
      try {
        const deletedSessions = await prisma.session.deleteMany({
          where: { userId: affiliateUser.id },
        });
        console.log('[Partner Login] 기존 세션 정리 완료:', { deletedCount: deletedSessions.count, userId: affiliateUser.id });
      } catch (cleanupError) {
        console.warn('[Partner Login] 기존 세션 정리 실패 (무시하고 계속):', cleanupError);
      }
      */

      const sessionId = randomBytes(32).toString('hex');
      const csrfToken = generateCsrfToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      console.log('[Partner Login] 세션 생성 시도:', { userId: affiliateUser.id, mallUserId: affiliateUser.mallUserId });

      let session: { id: string; csrfToken: string };
      try {
        session = await prisma.session.create({
          data: {
            id: sessionId,
            userId: affiliateUser.id,
            csrfToken,
            expiresAt,
          },
          select: { id: true, csrfToken: true },
        });
        console.log('[Partner Login] 세션 생성 완료:', { sessionId: session.id });
      } catch (sessionError: any) {
        console.error('[Partner Login] 세션 생성 실패:', sessionError);
        return NextResponse.json(
          { ok: false, error: '세션 생성 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, session.id, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined,
      });

      // 로그인 성공 후 후속 작업들을 병렬로 실행 (속도 개선)
      // 응답은 즉시 반환하고, 후속 작업은 백그라운드에서 실행
      const redirectPath = `/partner/${affiliateUser.mallUserId || identifierLower}/dashboard`;
      console.log('[Partner Login] 로그인 성공, 리다이렉트:', { redirectPath, mallUserId: affiliateUser.mallUserId });

      // 후속 작업들을 백그라운드에서 병렬 실행 (Promise.allSettled로 에러 무시)
      Promise.allSettled([
        prisma.user.update({
          where: { id: affiliateUser.id },
          data: {
            loginCount: { increment: 1 },
            lastActiveAt: new Date(),
          },
        }),
        reactivateUser(affiliateUser.id),
        updateLastActive(affiliateUser.id),
      ]).then(() => {
        authLogger.loginSuccess(affiliateUser.id, clientIp);
      }).catch((err) => {
        console.warn('[Partner Login] 후속 작업 중 오류 (무시됨):', err);
      });

      return NextResponse.json({
        ok: true,
        next: redirectPath,
        partnerId: affiliateUser.mallUserId || identifierLower,
        csrfToken: session.csrfToken,
      });
    }

    // 테스트 모드 비밀번호 (1101만 허용) - 관리자 모드에서는 제외
    // user1~user10 크루즈몰 계정은 제외 (아래에서 별도 처리)
    const isTestModePassword = TEST_MODE_PASSWORDS.includes(password);
    const isNotCruiseMallUser = !phone || !/^user(1[0]|[1-9])$/i.test(phone.trim());
    if (mode !== 'admin' && isTestModePassword && isNotCruiseMallUser) {
      const normalizedTestPassword = '1101';
      console.log('[Login] 테스트 모드 로그인 시도 (3일 체험):', { name: name || '없음', phone: phone || '없음', password: '***' });

      // 3일 체험 로그인: 이름/전화번호는 선택사항, 비밀번호 1101만 맞으면 무조건 로그인 가능

      try {
        // 3일 체험 로그인: 비밀번호 1101만 맞으면 무조건 로그인 가능 (가벼운 인증)
        // 전화번호로 기존 사용자 찾기 (모든 역할 검색)
        // 중요: 이미 존재하는 파트너/관리자 계정과 충돌 방지
        // 버그 방지: phone이 비어있으면 검색하지 않음 (undefined → Prisma 필터 무시 → 첫 번째 유저 반환 방지)
        let testUser = phone ? await prisma.user.findFirst({
          where: {
            phone,
          },
          include: {
            AffiliateProfile: {
              select: { id: true, status: true }
            }
          }
        }) : null;

        // 이미 존재하는 사용자가 파트너이거나 관리자인 경우, 테스트 모드 로그인 차단
        if (testUser) {
          const isPrivileged = testUser.role === 'admin' ||
            testUser.role === 'manager' ||
            testUser.role === 'community' || // 커뮤니티(파트너) 역할
            (testUser.AffiliateProfile);

          if (isPrivileged) {
            console.log('[Login] 테스트 모드 로그인 차단: 이미 존재하는 파트너/관리자 계정입니다.', { userId: testUser.id, role: testUser.role });
            return NextResponse.json(
              { ok: false, error: '이미 파트너 또는 관리자로 등록된 계정입니다. 해당 권한으로 로그인해주세요.' },
              { status: 400 }
            );
          }
        }


        console.log('[Login] 테스트 모드 사용자 조회 결과:', { found: !!testUser, userId: testUser?.id, customerStatus: testUser?.customerStatus, customerSource: testUser?.customerSource });

        // 사용자가 없으면 자동 생성 (테스트 모드) - 이름/전화번호 아무거나 입력해도 생성
        if (!testUser) {
          console.log('[Login] 테스트 모드 신규 사용자 생성 시작');
          const now = new Date();
          try {
            const newUser = await prisma.user.create({
              data: {
                name: name || '3일체험고객', // 이름이 없으면 기본값
                phone: phone || `test-${Date.now()}`, // 전화번호가 없으면 임시값
                password: normalizedTestPassword,
                onboarded: false,
                loginCount: 1,
                role: 'user',
                customerStatus: 'test',
                testModeStartedAt: now, // 테스트 모드 시작 시간 기록
                customerSource: 'test-guide', // 크루즈가이드 3일체험 고객
                updatedAt: now,
              },
              select: {
                id: true,
                name: true,
                phone: true,
                password: true,
                onboarded: true,
                loginCount: true,
                customerStatus: true,
                testModeStartedAt: true,
                customerSource: true,
              },
            });
            testUser = newUser;
          } catch (createError: any) {
            // 전화번호 중복 에러인 경우 (P2002)
            if (createError?.code === 'P2002') {
              console.log('[Login] 전화번호 중복, 기존 사용자 재조회 및 업데이트');
              // 전화번호로 다시 조회
              testUser = await prisma.user.findFirst({
                where: {
                  phone: phone || undefined,
                  role: 'user',
                },
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  password: true,
                  role: true,
                  onboarded: true,
                  loginCount: true,
                  customerStatus: true,
                  testModeStartedAt: true,
                  customerSource: true,
                },
              });

              if (testUser) {
                // 기존 사용자 업데이트: 이름, 비밀번호를 입력한 값으로 업데이트
                await prisma.user.update({
                  where: { id: testUser.id },
                  data: {
                    name: name || testUser.name,
                    phone: phone || testUser.phone,
                    password: normalizedTestPassword, // 비밀번호를 1101로 업데이트
                  },
                });
                testUser.name = name || testUser.name;
                testUser.phone = phone || testUser.phone;
                testUser.password = normalizedTestPassword;
                console.log('[Login] 기존 사용자 업데이트 완료 (중복 처리)');
              } else {
                throw createError; // 다른 에러면 그대로 throw
              }
            } else {
              throw createError; // 다른 에러면 그대로 throw
            }
          }
        } else {
          // 기존 사용자: 이름/전화번호/비밀번호 업데이트 (입력한 값으로 업데이트)
          // 1101로 로그인하면 만료 여부와 관계없이 체험기간 항상 리셋
          const resetNow = new Date();
          const isAlreadyExpired = testUser.customerStatus === 'test-locked' || (() => {
            if (!testUser.testModeStartedAt) return false;
            const end = new Date(testUser.testModeStartedAt);
            end.setHours(end.getHours() + 72);
            return resetNow > end;
          })();

          await prisma.user.update({
            where: { id: testUser.id },
            data: {
              name: name || testUser.name,
              phone: phone || testUser.phone,
              password: normalizedTestPassword,
              customerSource: 'test-guide',
              // 만료된 경우 체험기간 리셋 (1101 비밀번호 = 무조건 재시작 가능)
              ...(isAlreadyExpired ? {
                customerStatus: 'test',
                testModeStartedAt: resetNow,
              } : {}),
            },
          });
          testUser.name = name || testUser.name;
          testUser.phone = phone || testUser.phone;
          testUser.password = normalizedTestPassword;
          testUser.customerSource = 'test-guide';
          if (isAlreadyExpired) {
            testUser.customerStatus = 'test';
            testUser.testModeStartedAt = resetNow;
          }
        }

        const now = new Date();
        let testModeStartedAt: Date | null = testUser.testModeStartedAt;

        // 테스트 모드 시작 시간이 없으면 지금 시작
        if (!testModeStartedAt) {
          testModeStartedAt = now;
        }

        // 72시간 경과 확인
        const testModeEndAt = new Date(testModeStartedAt);
        testModeEndAt.setHours(testModeEndAt.getHours() + 72);

        // 72시간 경과 여부 확인 (로그인은 허용하되 완료 안내 표시)
        const isExpired = now > testModeEndAt;

        if (isExpired) {
          // 72시간 경과 → customerStatus를 'test-locked'로 변경 (완료 상태 표시용)
          // 하지만 로그인은 허용하여 완료 안내를 볼 수 있게 함
          await prisma.user.update({
            where: { id: testUser.id },
            data: {
              customerStatus: 'test-locked', // 완료 상태로 표시
              // isLocked는 false로 유지하여 로그인 허용
              // password는 1101로 유지하여 재로그인 가능
            },
          });

          // customerStatus 업데이트 반영
          testUser.customerStatus = 'test-locked';

          console.log('[Login] 테스트 모드 72시간 경과 - 완료 안내 표시를 위해 로그인 허용:', {
            userId: testUser.id,
            testModeStartedAt,
            testModeEndAt,
            expired: true
          });
        }

        // 3일 체험 초대 링크 처리
        let managerProfileId: number | null = null;
        let agentProfileId: number | null = null;
        let linkId: number | null = null;

        if (trialCode) {
          // AffiliateLink에서 trialCode로 링크 찾기
          const trialLink = await prisma.affiliateLink.findUnique({
            where: { code: trialCode },
            include: {
              AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile: {
                select: { id: true, affiliateCode: true },
              },
              AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile: {
                select: { id: true, affiliateCode: true },
              },
            },
          });

          if (trialLink) {
            managerProfileId = trialLink.managerId;
            agentProfileId = trialLink.agentId;
            linkId = trialLink.id; // linkId 저장
            console.log('[Login] 3일 체험 초대 링크 확인:', {
              trialCode,
              linkId: linkId,
              managerId: managerProfileId,
              agentId: agentProfileId
            });
          }
        } else if (affiliateCode) {
          // affiliateCode로 직접 찾기
          const profile = await prisma.affiliateProfile.findUnique({
            where: { affiliateCode: affiliateCode },
            select: { id: true, type: true },
          });

          if (profile) {
            if (profile.type === 'BRANCH_MANAGER') {
              managerProfileId = profile.id;
            } else if (profile.type === 'SALES_AGENT') {
              agentProfileId = profile.id;
              // 판매원인 경우 managerId도 찾기
              const relation = await prisma.affiliateRelation.findFirst({
                where: { agentId: profile.id, status: 'ACTIVE' },
                select: { managerId: true },
              });
              if (relation) {
                managerProfileId = relation.managerId;
              }
            }
          }
        }

        // AffiliateLead 생성 또는 업데이트 (잠재고객으로 항상 저장)
        // 이름과 연락처가 있으면 항상 잠재고객으로 저장 (managerId/agentId가 없어도 됨)
        if (name && phone) {
          const existingLead = await prisma.affiliateLead.findFirst({
            where: {
              customerPhone: phone,
            },
          });

          if (existingLead) {
            // 기존 Lead 업데이트
            await prisma.affiliateLead.update({
              where: { id: existingLead.id },
              data: {
                customerName: name,
                status: 'IN_PROGRESS',
                source: trialCode ? 'trial-invite-link' : (affiliateCode ? 'affiliate-link' : 'test-guide'),
                managerId: managerProfileId || existingLead.managerId,
                agentId: agentProfileId || existingLead.agentId,
                linkId: linkId || existingLead.linkId, // linkId 업데이트 (새 링크가 있으면 업데이트)
                updatedAt: now,
              },
            });
          } else {
            // 새 Lead 생성 (managerId/agentId가 없어도 생성)
            await prisma.affiliateLead.create({
              data: {
                customerName: name,
                customerPhone: phone,
                status: 'IN_PROGRESS',
                source: trialCode ? 'trial-invite-link' : (affiliateCode ? 'affiliate-link' : 'test-guide'),
                managerId: managerProfileId || null,
                agentId: agentProfileId || null,
                linkId: linkId || null, // linkId 저장
                updatedAt: now,
              },
            });
          }
          console.log('[Login] AffiliateLead 생성/업데이트 완료 (잠재고객):', {
            linkId: linkId,
            managerId: managerProfileId,
            agentId: agentProfileId,
            phone: phone ? `${phone.substring(0, 3)}***` : 'empty'
          });
        }

        // 테스트 모드 활성화
        // 비밀번호 1101로 로그인하면 무조건 무료체험 사용자로 전환 (유료 고객이어도 무시)
        // 72시간 경과 시 'test-locked'로 이미 설정되었으므로 덮어쓰지 않음
        const shouldSetTestStatus = !isExpired; // 72시간 경과가 아니면 무조건 'test'로 설정
        await prisma.user.update({
          where: { id: testUser.id },
          data: {
            ...(shouldSetTestStatus && { customerStatus: 'test' }), // 무조건 무료체험 모드로 전환 (유료 고객 상태 무시)
            testModeStartedAt: testModeStartedAt || now, // null 체크 후 할당
            isLocked: false,
            isHibernated: false,
            loginCount: { increment: 1 },
            customerSource: trialCode ? 'trial-invite-link' : 'test-guide', // 무조건 무료체험 사용자로 전환 (유료 고객이어도 무시)
            password: normalizedTestPassword, // 비밀번호는 항상 1101로 업데이트
          },
        });

        // 테스트 모드: SAMPLE-MED-001 상품으로 UserTrip 자동 생성/업데이트
        // UserTrip 별도 조회 (endDate 포함 - 만료 여부 확인용)
        const existingTrip = await prisma.userTrip.findFirst({
          where: { userId: testUser.id },
          select: { id: true, productId: true, endDate: true },
        });

        console.log('[Auth Login] 테스트 모드: UserTrip 존재 여부 확인 시작:', {
          userId: testUser.id,
          hasTrip: !!existingTrip,
          tripId: existingTrip?.id,
          productId: existingTrip?.productId
        });

        console.log('[Auth Login] 테스트 모드: Trip 존재 여부 확인 결과:', {
          userId: testUser.id,
          hasTrip: !!existingTrip,
          tripId: existingTrip?.id,
          productId: existingTrip?.productId
        });

        // SAMPLE-MED-001 상품 조회, 없으면 TEST-001로 fallback
        console.log('[Auth Login] 테스트 모드: 테스트 상품 조회 시작');
        let product = await prisma.cruiseProduct.findUnique({
          where: { productCode: 'SAMPLE-MED-001' },
        });

        // SAMPLE-MED-001이 없으면 TEST-001로 fallback
        if (!product) {
          console.log('[Auth Login] 테스트 모드: SAMPLE-MED-001 없음, TEST-001로 fallback');
          product = await prisma.cruiseProduct.findUnique({
            where: { productCode: 'TEST-001' },
          });
        }

        console.log('[Auth Login] 테스트 모드: 테스트 상품 조회 결과:', {
          found: !!product,
          productId: product?.id,
          productCode: product?.productCode,
          cruiseLine: product?.cruiseLine,
          shipName: product?.shipName,
          nights: product?.nights,
          days: product?.days,
          hasItineraryPattern: !!product?.itineraryPattern,
        });

        // 기존 UserTrip 삭제 조건: 상품이 다르거나, endDate가 과거(만료된 여행) → 재생성
        const isTripExpired = existingTrip?.endDate
          ? new Date() > new Date(existingTrip.endDate)
          : false;
        const isTripWrongProduct = existingTrip && product && existingTrip.productId !== product.id;

        if (existingTrip && (isTripWrongProduct || isTripExpired)) {
          console.log('[Auth Login] 테스트 모드: 기존 UserTrip 삭제 후 재생성:', {
            userId: testUser.id,
            reason: isTripWrongProduct ? 'wrong_product' : 'trip_expired',
            existingTripId: existingTrip.id,
            existingEndDate: existingTrip.endDate,
          });

          // 기존 UserTrip과 관련된 Itinerary 삭제
          await prisma.itinerary.deleteMany({
            where: { userTripId: existingTrip.id },
          });

          await prisma.userTrip.delete({
            where: { id: existingTrip.id },
          });

          console.log('[Auth Login] 테스트 모드: ✅ 기존 UserTrip 삭제 완료');
        }

        // UserTrip이 없거나 삭제된 경우 새로 생성
        if ((!existingTrip || isTripWrongProduct || isTripExpired) && product) {
          console.log('[Auth Login] 테스트 모드: UserTrip 생성 시작');
          console.log('[Auth Login] 테스트 모드: 현재 시간:', now.toISOString());

          try {
            console.log('[Auth Login] 테스트 모드: ✅ SAMPLE-MED-001 상품 찾음, UserTrip 생성 시작');

            // 출발일: 로그인 당일 (브리핑 API가 오늘 날짜로 Itinerary 조회하므로 당일 시작)
            const startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);

            // 종료 날짜 계산 (출발일 + (days - 1)일)
            // 예: 5박 6일이면 출발일 + 5일 = 종료일
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + product.days - 1);
            endDate.setHours(23, 59, 59, 999);

            console.log('[Auth Login] 테스트 모드: 날짜 계산 완료:', {
              loginDate: now.toISOString().split('T')[0],
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              nights: product.nights,
              days: product.days,
            });

            // 목적지 배열 생성 (itineraryPattern에서 추출)
            const itineraryPattern = normalizeItineraryPattern(product.itineraryPattern);
            const destinations = extractDestinationsFromItineraryPattern(product.itineraryPattern);
            const visitedCountries = extractVisitedCountriesFromItineraryPattern(product.itineraryPattern);

            // 예약번호 자동 생성
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const reservationCode = `CRD-${dateStr}-${randomStr}`;

            console.log('[Auth Login] 테스트 모드: UserTrip 생성 데이터 준비 완료:', {
              userId: testUser.id,
              productId: product.id,
              reservationCode,
              cruiseName: `${product.cruiseLine} ${product.shipName}`,
              destinations: destinations,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              nights: product.nights,
              days: product.days,
              visitCount: destinations.length,
            });

            // UserTrip 생성
            console.log('[Auth Login] 테스트 모드: UserTrip 생성 시작 (DB insert)');
            const trip = await prisma.userTrip.create({
              data: {
                userId: testUser.id,
                productId: product.id,
                reservationCode,
                cruiseName: `${product.cruiseLine} ${product.shipName}`,
                companionType: '가족', // 기본값
                destination: destinations,
                startDate,
                endDate,
                nights: product.nights,
                days: product.days,
                visitCount: destinations.length,
                status: 'Upcoming',
                updatedAt: new Date(), // updatedAt 필드 추가
              },
            });

            console.log('[Auth Login] 테스트 모드: ✅ UserTrip 생성 성공:', {
              tripId: trip.id,
              userId: testUser.id,
              cruiseName: `${product.cruiseLine} ${product.shipName}`,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              nights: product.nights,
              days: product.days,
            });

            // Itinerary 레코드들 자동 생성
            console.log('[Auth Login] 테스트 모드: Itinerary 생성 시작:', {
              itineraryPatternLength: itineraryPattern.length,
              tripId: trip.id,
            });

            const itineraries = [];
            for (const pattern of itineraryPattern) {
              const dayDate = new Date(startDate);
              dayDate.setDate(dayDate.getDate() + pattern.day - 1);

              itineraries.push({
                userTripId: trip.id,
                day: pattern.day,
                date: dayDate,
                type: pattern.type,
                location: pattern.location || null,
                country: pattern.country || null,
                currency: pattern.currency || null,
                language: pattern.language || null,
                arrival: pattern.arrival || null,
                departure: pattern.departure || null,
                time: pattern.time || null,
                updatedAt: new Date(),
              });
            }

            console.log('[Auth Login] 테스트 모드: Itinerary 데이터 준비 완료:', {
              count: itineraries.length,
              tripId: trip.id,
            });

            await prisma.itinerary.createMany({
              data: itineraries,
            });

            console.log('[Auth Login] 테스트 모드: ✅ Itinerary 생성 완료:', {
              count: itineraries.length,
              tripId: trip.id,
            });

            // VisitedCountry 업데이트
            for (const [countryCode, countryInfo] of visitedCountries) {
              await prisma.visitedCountry.upsert({
                where: {
                  userId_countryCode: {
                    userId: testUser.id,
                    countryCode,
                  },
                },
                update: {
                  visitCount: { increment: 1 },
                  lastVisited: startDate,
                },
                create: {
                  userId: testUser.id,
                  countryCode,
                  countryName: countryInfo.name,
                  visitCount: 1,
                  lastVisited: startDate,
                },
              });
            }

            // 온보딩 완료 상태로 설정
            console.log('[Auth Login] 테스트 모드: 온보딩 완료 상태 설정 시작:', {
              userId: testUser.id,
            });

            await prisma.user.update({
              where: { id: testUser.id },
              data: {
                onboarded: true,
                totalTripCount: { increment: 1 },
              },
            });

            console.log('[Auth Login] 테스트 모드: ✅ 온보딩 완료 상태 설정 완료:', {
              userId: testUser.id,
              onboarded: true,
            });

            console.log('[Auth Login] Test mode: Auto-created trip for user', testUser.id, 'with product SAMPLE-MED-001', {
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              nights: product.nights,
              days: product.days,
              loginDate: now.toISOString().split('T')[0],
              dday: Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
            });
          } catch (tripError) {
            console.error('[Auth Login] Test mode: Failed to auto-create UserTrip:', tripError);
            console.error('[Auth Login] Test mode: UserTrip creation error details:', {
              error: tripError instanceof Error ? tripError.message : String(tripError),
              stack: tripError instanceof Error ? tripError.stack : undefined,
              name: tripError instanceof Error ? tripError.name : undefined,
              userId: testUser.id,
              userName: testUser.name,
            });

            // UserTrip 생성 실패 시에도 로그인은 계속 진행하되, 에러를 명확히 기록
            // 나중에 관리자가 확인할 수 있도록
          }
        } else if (existingTrip && product && existingTrip.productId === product.id) {
          console.log('[Auth Login] 테스트 모드: 기존 UserTrip이 SAMPLE-MED-001임, UserTrip 생성 건너뜀:', {
            userId: testUser.id,
            tripId: existingTrip.id,
            productId: existingTrip.productId,
          });
        } else if (!product) {
          console.error('[Auth Login] 테스트 모드: ❌ SAMPLE-MED-001 상품을 찾을 수 없습니다!');
          console.warn('[Auth Login] Test mode: SAMPLE-MED-001 product not found');
        }

        // UserTrip 생성 후 다시 확인 (디버깅용) - 실제 DB에서 조회
        const finalTripCheck = await prisma.userTrip.findFirst({
          where: { userId: testUser.id },
          select: { id: true, cruiseName: true, startDate: true },
        });
        console.log('[Auth Login] 테스트 모드: 세션 생성 전 최종 UserTrip 확인 (DB 조회):', {
          userId: testUser.id,
          hasTrip: !!finalTripCheck,
          tripId: finalTripCheck?.id,
          cruiseName: finalTripCheck?.cruiseName,
        });

        // UserTrip이 없으면 경고 로그 출력 (하지만 로그인은 계속 진행)
        if (!finalTripCheck) {
          console.warn('[Auth Login] 테스트 모드: ⚠️ 경고 - UserTrip이 생성되지 않았습니다!', {
            userId: testUser.id,
            userName: testUser.name,
            phone: testUser.phone,
          });
        }

        const userId = testUser.id;
        // 비밀번호 1101 = 크루즈 가이드 지니 3일 체험 → /chat-test로 강제 리다이렉트
        const next = '/chat-test';

        // 기존 세션 정리 (동시 로그인 방지 및 세션 테이블 정리)
        try {
          const deletedSessions = await prisma.session.deleteMany({
            where: { userId },
          });
          console.log('[Login] 테스트 모드 기존 세션 정리 완료:', { deletedCount: deletedSessions.count, userId });
        } catch (cleanupError) {
          console.warn('[Login] 테스트 모드 기존 세션 정리 실패 (무시하고 계속):', cleanupError);
        }

        // 세션 생성
        const sessionId = randomBytes(32).toString('hex');
        const csrfToken = generateCsrfToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const session = await prisma.session.create({
          data: {
            id: sessionId,
            userId,
            csrfToken,
            expiresAt,
          },
          select: { id: true, csrfToken: true },
        });

        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE, session.id, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
          secure: process.env.NODE_ENV === 'production',
          domain: process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined,
        });
        // 3일 체험 유저 표시 쿠키 (middleware에서 -test 경로 강제 리다이렉트에 사용)
        cookieStore.set('cg.mode', 'test', {
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        });

        authLogger.loginSuccess(userId, clientIp);
        reactivateUser(userId).catch(() => {});
        updateLastActive(userId).catch(() => {});

        // 남은 시간 계산 (음수면 0으로 표시)
        const remainingMs = testModeEndAt.getTime() - now.getTime();
        const testModeRemainingHours = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));

        return NextResponse.json({
          ok: true,
          next,
          csrfToken: session.csrfToken,
          testMode: true, // 테스트 모드 플래그
          testModeRemainingHours, // 남은 시간 (0이면 완료)
          testModeExpired: isExpired, // 완료 여부 플래그 추가
        });
      } catch (testModeError) {
        // 상세한 오류 로깅
        const errorMessage = testModeError instanceof Error ? testModeError.message : String(testModeError);
        const errorStack = testModeError instanceof Error ? testModeError.stack : undefined;
        const errorName = testModeError instanceof Error ? testModeError.name : undefined;

        console.error('[Auth Login] ❌ 테스트 모드 로그인 오류 발생!');
        console.error('[Auth Login] Test mode error:', testModeError);
        console.error('[Auth Login] Test mode error details:', {
          error: errorMessage,
          stack: errorStack,
          errorName: errorName,
          phone,
          userName: name,
          timestamp: new Date().toISOString(),
        });

        // Prisma 오류인 경우 추가 정보 출력
        if (testModeError && typeof testModeError === 'object' && 'code' in testModeError) {
          console.error('[Auth Login] Prisma error code:', (testModeError as any).code);
          console.error('[Auth Login] Prisma error meta:', (testModeError as any).meta);
        }

        // 테스트 모드 처리 중 에러 발생 시 에러 반환
        return NextResponse.json({
          ok: false,
          error: '테스트 모드 로그인 중 오류가 발생했습니다.',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          // 개발 환경에서는 스택 트레이스도 포함
          stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        }, { status: 500 });
      }
    }

    // 비밀번호 기반 상태 구분: 8300 = 잠금 (로그인 불가)
    if (password === '8300') {
      return NextResponse.json({
        ok: false,
        error: '로그인이 불가능한 계정입니다. 관리자에게 문의해주세요.'
      }, { status: 403 });
    }

    if (!phone || !password) {
      return NextResponse.json({ ok: false, error: '전화번호/비밀번호가 필요합니다.' }, { status: 400 });
    }

    // 커뮤니티 로그인 처리 (크루즈몰 회원 로그인)
    if (mode === 'community') {
      try {
        // 크루즈몰 회원 찾기
        // phone 파라미터는 실제로는 username(아이디)임
        // 1. 먼저 mallUserId 필드로 찾기 (새로운 방식)
        // 2. 없으면 phone 필드로 찾기 (레거시 지원 - 기존 회원)
        // role='community' AND customerSource='mall-signup'으로 필터링하여 기존 고객과 완전히 격리
        const trimmedUsername = phone.trim();

        let communityUser = await prisma.user.findFirst({
          where: {
            OR: [
              { mallUserId: trimmedUsername }, // 새로운 방식: mallUserId 필드
              { phone: trimmedUsername } // 레거시 지원: phone 필드 (기존 회원)
            ],
            role: 'community', // 크루즈몰 회원은 role이 'community'
            customerSource: 'mall-signup' // 크루즈몰 회원가입 사용자만 (기존 고객과 격리)
          },
          select: { id: true, name: true, role: true, password: true, mallUserId: true, mallNickname: true, phone: true }
        });

        if (!communityUser) {
          console.log('[Auth Login] Community user not found:', { username: trimmedUsername });
          return NextResponse.json({
            ok: false,
            error: '아이디 또는 비밀번호가 올바르지 않습니다.'
          }, { status: 401 });
        }

        // 레거시 사용자 마이그레이션: phone 필드에 아이디가 저장된 경우 mallUserId로 마이그레이션
        if (!communityUser.mallUserId && communityUser.phone === trimmedUsername) {
          console.log('[Auth Login] 레거시 사용자 마이그레이션:', { userId: communityUser.id, phone: communityUser.phone });
          await prisma.user.update({
            where: { id: communityUser.id },
            data: { mallUserId: trimmedUsername }
          });
          communityUser.mallUserId = trimmedUsername;
        }

        // 비밀번호 확인 (bcrypt 해시 또는 평문 비교)
        let isPasswordValid = false;
        const storedPassword = communityUser.password || '';

        // bcrypt 해시인지 확인 ($2로 시작)
        if (storedPassword.startsWith('$2')) {
          try {
            const bcrypt = await import('bcryptjs');
            isPasswordValid = await bcrypt.default.compare(password, storedPassword);
            console.log('[Auth Login] Community bcrypt 비교 결과:', { userId: communityUser.id, isValid: isPasswordValid });
          } catch (bcryptError) {
            console.warn('[Auth Login] bcrypt 비교 중 오류:', bcryptError);
            isPasswordValid = false;
          }
        } else if (storedPassword.length > 0) {
          // 평문 비밀번호인 경우 (레거시 지원)
          isPasswordValid = storedPassword === password;
          console.log('[Auth Login] Community 평문 비밀번호 비교 결과:', { userId: communityUser.id, isValid: isPasswordValid });
        }

        if (!isPasswordValid) {
          console.log('[Auth Login] Invalid password for community user:', { userId: communityUser.id, mallUserId: communityUser.mallUserId });
          return NextResponse.json({
            ok: false,
            error: '아이디 또는 비밀번호가 올바르지 않습니다.'
          }, { status: 401 });
        }

        const userId = communityUser.id;
        const next = '/'; // 크루즈몰 메인 페이지로 이동

        // 기존 세션 정리 (동시 로그인 방지 및 세션 테이블 정리)
        try {
          const deletedSessions = await prisma.session.deleteMany({
            where: { userId },
          });
          console.log('[Auth Login] Community 기존 세션 정리 완료:', { deletedCount: deletedSessions.count, userId });
        } catch (cleanupError) {
          console.warn('[Auth Login] Community 기존 세션 정리 실패 (무시하고 계속):', cleanupError);
        }

        // 세션 ID 생성
        const sessionId = randomBytes(32).toString('hex');

        // CSRF 토큰 생성
        const csrfToken = generateCsrfToken();

        // 세션 만료 시간 설정 (30일)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // 세션 생성
        const session = await prisma.session.create({
          data: {
            id: sessionId,
            userId,
            csrfToken,
            expiresAt,
          },
          select: { id: true, csrfToken: true },
        });

        // 쿠키 심기
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE, session.id, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30일
          secure: process.env.NODE_ENV === 'production',
          domain: process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined,
        });

        // 로그인 성공 로그
        authLogger.loginSuccess(userId, clientIp);

        console.log('[Auth Login] Community login success:', { userId, mallUserId: communityUser.mallUserId });

        return NextResponse.json({
          ok: true,
          next,
          csrfToken: session.csrfToken,
        });
      } catch (communityError: any) {
        console.error('[Auth Login] Community login error:', communityError);
        return NextResponse.json({
          ok: false,
          error: process.env.NODE_ENV === 'development'
            ? `로그인 중 오류가 발생했습니다: ${communityError.message || 'Unknown error'}`
            : '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }, { status: 500 });
      }
    }

    // 관리자 로그인 처리 - 허용된 관리자만 로그인 가능
    if (mode === 'admin') {
      console.log('[Admin Login] ========================================');
      console.log('[Admin Login] 시작:', {
        name: JSON.stringify(name),
        nameLength: name?.length,
        phone: phone ? `${phone.substring(0, 3)}***` : 'empty',
        phoneLength: phone?.length,
        password: password ? '***' : 'empty',
        passwordLength: password?.length
      });

      try {
        if (!name || !phone || !password) {
          console.log('[Admin Login] 입력값 누락:', { hasName: !!name, hasPhone: !!phone, hasPassword: !!password });
          return NextResponse.json({ ok: false, error: '이름, 전화번호, 비밀번호를 모두 입력해주세요.' }, { status: 400 });
        }

        // 입력값 정규화
        const normalizedName = name.trim();
        const normalizedPhone = phone.replace(/[-\s]/g, '');

        // 허용된 관리자 목록 (2명만)
        const ALLOWED_ADMINS = [
          { name: '저스틴', phone: '01038609161', password: '0313' },
          { name: '모니카', phone: '01024958013', password: '0313' },
        ];

        // 허용된 관리자인지 확인
        const allowedAdmin = ALLOWED_ADMINS.find(
          admin => admin.name === normalizedName && admin.phone === normalizedPhone
        );

        if (!allowedAdmin) {
          console.log('[Admin Login] 허용되지 않은 관리자:', { name: normalizedName, phone: normalizedPhone });
          return NextResponse.json({
            ok: false,
            error: '관리자 권한이 없습니다.'
          }, { status: 403 });
        }

        // 비밀번호 확인
        if (password !== allowedAdmin.password) {
          console.log('[Admin Login] 비밀번호 불일치');
          return NextResponse.json({
            ok: false,
            error: '비밀번호가 올바르지 않습니다.'
          }, { status: 401 });
        }

        // DB에서 관리자 계정 조회 또는 생성
        let adminUser = await prisma.user.findFirst({
          where: {
            name: normalizedName,
            phone: normalizedPhone,
            role: 'admin',
          },
          select: {
            id: true,
            password: true,
            loginCount: true,
            name: true,
            phone: true,
          },
        });

        // 관리자 계정이 없으면 생성
        if (!adminUser) {
          console.log('[Admin Login] 관리자 계정 생성:', { name: normalizedName, phone: normalizedPhone });
          try {
            const now = new Date();
            adminUser = await prisma.user.create({
              data: {
                name: normalizedName,
                phone: normalizedPhone,
                password: password,
                role: 'admin',
                onboarded: true,
                loginCount: 0,
                customerSource: 'admin',
                updatedAt: now,
              },
              select: {
                id: true,
                password: true,
                loginCount: true,
                name: true,
                phone: true,
              },
            });
            console.log('[Admin Login] 관리자 계정 생성 완료:', { userId: adminUser.id });
          } catch (createError: any) {
            console.error('[Admin Login] 관리자 계정 생성 실패:', createError);
            // 중복 키 에러인 경우 다시 조회 시도
            if (createError?.code === 'P2002') {
              adminUser = await prisma.user.findFirst({
                where: {
                  phone: normalizedPhone,
                  role: 'admin',
                },
                select: {
                  id: true,
                  password: true,
                  loginCount: true,
                  name: true,
                  phone: true,
                },
              });
            }

            if (!adminUser) {
              return NextResponse.json({
                ok: false,
                error: '관리자 계정 생성에 실패했습니다. 잠시 후 다시 시도해주세요.'
              }, { status: 500 });
            }
          }
        }

        // 비밀번호 확인 (DB에 저장된 비밀번호도 확인)
        const isPasswordValid = adminUser.password === password;
        console.log('[Admin Login] 비밀번호 확인:', { isValid: isPasswordValid });

        if (!isPasswordValid) {
          // DB 비밀번호와 일치하지 않으면 업데이트
          await prisma.user.update({
            where: { id: adminUser.id },
            data: { password: password },
          });
          console.log('[Admin Login] 비밀번호 업데이트 완료');
        }

        console.log('[Admin Login] 성공:', { userId: adminUser.id });

        const userId = adminUser.id;
        const next = '/admin/dashboard';

        // customerSource 조회 시도 (필드가 없을 수 있음)
        let customerSourceValue: string | null = null;
        try {
          const userWithSource = await prisma.user.findUnique({
            where: { id: userId },
            select: { customerSource: true },
          });
          customerSourceValue = userWithSource?.customerSource || null;
        } catch (sourceError) {
          console.warn('[Admin Login] customerSource 조회 실패 (무시):', sourceError);
        }

        // 세션 ID 생성 (32바이트 랜덤 값을 hex 문자열로)
        const sessionId = randomBytes(32).toString('hex');
        const csrfToken = generateCsrfToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // 세션 생성과 기존 세션 정리를 병렬로 실행 (속도 개선)
        const [session] = await Promise.all([
          prisma.session.create({
            data: {
              id: sessionId,
              userId,
              csrfToken,
              expiresAt,
            },
            select: { id: true, csrfToken: true },
          }),
          // 기존 세션 정리 (새 세션 ID 제외)
          prisma.session.deleteMany({
            where: { userId, id: { not: sessionId } },
          }).catch(() => { }), // 에러 무시
        ]);

        // 쿠키 설정
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE, session.id, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
          secure: process.env.NODE_ENV === 'production',
          domain: process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined,
        });

        // 후속 작업들은 백그라운드에서 병렬 실행 (응답 속도 개선)
        Promise.allSettled([
          prisma.user.update({
            where: { id: userId },
            data: {
              loginCount: { increment: 1 },
              lastActiveAt: new Date(),
              ...(customerSourceValue === null && { customerSource: 'admin' }),
            },
          }),
          reactivateUser(userId),
          updateLastActive(userId),
        ]).then(() => {
          authLogger.loginSuccess(userId, clientIp);
        }).catch(() => { });

        return NextResponse.json({
          ok: true,
          next,
          csrfToken: session.csrfToken,
        });
      } catch (adminError: any) {
        console.error('[Admin Login] 관리자 로그인 처리 중 오류:', adminError);
        console.error('[Admin Login] 오류 상세:', {
          message: adminError instanceof Error ? adminError.message : String(adminError),
          stack: adminError instanceof Error ? adminError.stack : undefined,
          name: adminError instanceof Error ? adminError.name : undefined,
          code: adminError?.code,
          meta: adminError?.meta,
        });
        const errorMessage = adminError instanceof Error ? adminError.message : String(adminError);
        return NextResponse.json({
          ok: false,
          error: '관리자 로그인 중 오류가 발생했습니다.',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        }, { status: 500 });
      }
    }

    // 일반 사용자 로그인 처리
    // ✅ 이름, 전화번호, 비밀번호, role 4가지를 모두 정확히 확인하여 충돌 방지
    // 주의: 테스트 모드는 위에서 이미 처리되었으므로 여기서는 제외됨

    // 비밀번호 기반 상태 구분: 8300 = 잠금 (로그인 불가)
    if (password === '8300') {
      return NextResponse.json({
        ok: false,
        error: '로그인이 불가능한 계정입니다. 관리자에게 문의해주세요.'
      }, { status: 403 });
    }

    if (!phone || !password) {
      return NextResponse.json({ ok: false, error: '전화번호/비밀번호가 필요합니다.' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ ok: false, error: '이름이 필요합니다.' }, { status: 400 });
    }

    // 비밀번호 기반 상태 구분: 3800 = 활성화
    // 동면 고객 자동 전환: 이름=연락처, 비밀번호=3800으로 로그인한 경우
    // 동면 고객(이름=연락처, 비밀번호=연락처)이 여행 계약 후 3800으로 로그인하면 활성으로 전환
    if (password === '3800' && name === phone) {
      // 동면 고객 찾기: 이름=연락처, 비밀번호=연락처인 고객
      const dormantUser = await prisma.user.findFirst({
        where: {
          phone,
          name: phone,  // 동면 고객은 이름=연락처
          password: phone,  // 동면 고객은 비밀번호=연락처
          role: 'user',
        },
        select: { id: true, onboarded: true, loginCount: true, isHibernated: true, customerStatus: true, customerSource: true },
      });

      if (dormantUser) {
        console.log('[Login] 동면 고객 자동 전환:', { userId: dormantUser.id, phone, name });

        // 동면에서 활성으로 전환: 비밀번호를 3800으로 업데이트, 동면 상태 해제, 활성 상태로 설정, 로그인 횟수 증가
        await prisma.user.update({
          where: { id: dormantUser.id },
          data: {
            password: '3800',
            isHibernated: false,
            hibernatedAt: null,
            customerStatus: 'active', // 활성 상태로 설정
            testModeStartedAt: null, // 테스트 모드 해제
            loginCount: { increment: 1 },
            customerSource: dormantUser.customerSource || 'cruise-guide', // customerSource가 없으면 설정
          },
        });

        // 온보딩 완료 → /chat, 미완료 → /onboarding
        const next = dormantUser.onboarded ? '/chat' : '/onboarding';
        const userId = dormantUser.id;

        // 세션 ID 생성 (32바이트 랜덤 값을 hex 문자열로)
        const sessionId = randomBytes(32).toString('hex');

        // CSRF 토큰 생성
        const csrfToken = generateCsrfToken();

        // 세션 만료 시간 설정 (30일)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // 세션 생성
        const session = await prisma.session.create({
          data: {
            id: sessionId,
            userId,
            csrfToken,
            expiresAt,
          },
          select: { id: true, csrfToken: true },
        });

        // 쿠키 심기
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE, session.id, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30일
          secure: process.env.NODE_ENV === 'production',
          domain: process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined,
        });

        // 로그인 성공 로그
        authLogger.loginSuccess(userId, clientIp);

        // 생애주기 관리: 백그라운드 처리 (응답 속도에 영향 없음)
        reactivateUser(userId).catch(() => {});
        updateLastActive(userId).catch(() => {});

        console.log('[Login] 동면 고객 자동 전환 완료:', { userId, phone, name });

        return NextResponse.json({
          ok: true,
          next,
          csrfToken: session.csrfToken,
        });
      }
    }

    // 비밀번호 기반 상태 구분: 3800 = 활성화
    // 잠금 상태 고객 자동 전환: 이름, 연락처, 3800으로 로그인한 경우
    // 잠금 상태였던 고객이 3800으로 로그인하면 자동으로 활성 상태로 전환
    if (password === '3800') {
      console.log('[Login] 3800 로그인 시도:', { phone, name });

      // ✅ 전화번호 정규화 (등록 API와 동일하게)
      const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
      const normalizedPhone = normalizePhone(phone);

      // 이름, 정규화된 전화번호로 사용자 찾기 (비밀번호는 나중에 확인)
      let activeUser = await prisma.user.findFirst({
        where: {
          phone: normalizedPhone,
          name,
          role: 'user',
        },
        select: {
          id: true,
          password: true,
          onboarded: true,
          loginCount: true,
          isLocked: true,
          customerStatus: true,
          customerSource: true,
          UserTrip: { select: { id: true }, take: 1 },
        },
      });

      console.log('[Login] 3800 사용자 조회 결과:', {
        found: !!activeUser,
        userId: activeUser?.id,
        passwordMatch: activeUser?.password === '3800',
        customerStatus: activeUser?.customerStatus,
        isLocked: activeUser?.isLocked,
      });

      // 사용자가 없으면 자동 생성 (크루즈 가이드 지니 AI 요구사항)
      if (!activeUser) {
        console.log('[Login] 3800 신규 사용자 자동 생성:', { phone: normalizedPhone, name });
        try {
          const now = new Date();
          const newUser = await prisma.user.create({
            data: {
              name,
              phone: normalizedPhone, // 정규화된 전화번호 사용
              password: '3800',
              onboarded: false, // 온보딩 없이 채팅창에 들어갈 수 있도록 false로 설정
              loginCount: 1,
              role: 'user',
              customerStatus: 'active',
              customerSource: 'cruise-guide',
              updatedAt: now,
            },
            select: {
              id: true,
              password: true,
              onboarded: true,
              loginCount: true,
              isLocked: true,
              customerStatus: true,
              customerSource: true,
              UserTrip: { select: { id: true }, take: 1 },
            },
          });
          activeUser = newUser;
          console.log('[Login] 3800 신규 사용자 생성 완료:', { userId: activeUser.id, phone, name });
        } catch (createError) {
          console.error('[Login] 3800 신규 사용자 생성 실패:', createError);
          return NextResponse.json({
            ok: false,
            error: '사용자 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
          }, { status: 500 });
        }
      } else {
        // 기존 사용자: customerSource 확인
        const userSource = activeUser.customerSource || null;
        console.log('[Login] 3800 기존 사용자 확인:', {
          userId: activeUser.id,
          customerSource: userSource,
          passwordMatch: activeUser.password === '3800',
        });

        // 크루즈 가이드 지니 AI에서 3800으로 로그인하는 경우
        // customerSource가 무엇이든 상관없이 이름과 전화번호가 일치하면 로그인 허용
        // 단, customerSource를 'cruise-guide'로 업데이트하고 비밀번호를 3800으로 설정
        if (activeUser.password !== '3800' || userSource !== 'cruise-guide') {
          console.log('[Login] 3800 비밀번호 및 customerSource 자동 업데이트:', {
            userId: activeUser.id,
            oldPassword: activeUser.password ? '***' : 'null',
            oldCustomerSource: userSource,
            newCustomerSource: 'cruise-guide',
          });
          // 비밀번호를 3800으로 업데이트하고 customerSource를 'cruise-guide'로 설정
          await prisma.user.update({
            where: { id: activeUser.id },
            data: {
              password: '3800',
              customerSource: 'cruise-guide', // 크루즈 가이드 지니 AI로 전환
            },
          });
          // 업데이트 후 activeUser 객체도 업데이트
          activeUser.password = '3800';
          activeUser.customerSource = 'cruise-guide';
        }
      }

      console.log('[Login] 활성 고객 로그인:', { userId: activeUser.id, phone, name });

      try {
        // 활성 상태로 전환: 잠금 상태 해제, 활성 상태로 설정, 테스트 모드 해제, 로그인 횟수 증가
        await prisma.user.update({
          where: { id: activeUser.id },
          data: {
            isLocked: false,
            isHibernated: false,
            customerStatus: 'active', // 활성 상태로 설정
            loginCount: { increment: 1 },
            customerSource: activeUser.customerSource || 'cruise-guide', // customerSource가 없으면 설정
            ...(activeUser.isLocked && {
              lockedAt: null,
              lockedReason: null,
            }),
            ...(activeUser.customerStatus === 'test' && {
              testModeStartedAt: null, // 테스트 모드 해제
            }),
          },
        });
      } catch (updateError) {
        console.error('[Login] 활성 고객 상태 업데이트 실패:', updateError);
        throw updateError;
      }

      // 유료 고객(3800): REAL-CRUISE-01 상품으로 UserTrip 자동 생성/업데이트
      console.log('[Login] 3800: UserTrip 자동 생성 체크 시작:', { userId: activeUser.id });

      const existingUserTrip = await prisma.userTrip.findFirst({
        where: { userId: activeUser.id },
        select: { id: true, productId: true },
      });

      console.log('[Login] 3800: UserTrip 존재 여부 확인:', {
        userId: activeUser.id,
        hasTrip: !!existingUserTrip,
        tripId: existingUserTrip?.id,
        productId: existingUserTrip?.productId
      });

      // REAL-CRUISE-01 상품 조회
      const realProduct = await prisma.cruiseProduct.findUnique({
        where: { productCode: 'REAL-CRUISE-01' },
      });

      console.log('[Login] 3800: REAL-CRUISE-01 상품 조회 결과:', {
        found: !!realProduct,
        productId: realProduct?.id,
        productCode: realProduct?.productCode,
        cruiseLine: realProduct?.cruiseLine,
        shipName: realProduct?.shipName,
        nights: realProduct?.nights,
        days: realProduct?.days,
      });

      // 유료 고객(3800): 어드민 등록 UserTrip 보존 우선
      // existingUserTrip이 없을 때만 REAL-CRUISE-01 폴백 생성 (어드민 미등록 케이스)
      if (!existingUserTrip && realProduct) {
        console.log('[Login] 3800: UserTrip 없음 — REAL-CRUISE-01 폴백 생성 시작');

        try {
          const now = new Date();

          // 출발일: 오늘 + 30일 (D-30)
          const startDate = new Date(now);
          startDate.setDate(startDate.getDate() + 30);
          startDate.setHours(0, 0, 0, 0);

          // 종료 날짜 계산 (출발일 + (days - 1)일)
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + realProduct.days - 1);
          endDate.setHours(23, 59, 59, 999);

          console.log('[Login] 3800: 날짜 계산 완료:', {
            today: now.toISOString().split('T')[0],
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            nights: realProduct.nights,
            days: realProduct.days,
            dday: Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          });

          // 목적지 배열 생성 (itineraryPattern에서 추출)
          const itineraryPattern = normalizeItineraryPattern(realProduct.itineraryPattern);
          const destinations = extractDestinationsFromItineraryPattern(realProduct.itineraryPattern);
          const visitedCountries = extractVisitedCountriesFromItineraryPattern(realProduct.itineraryPattern);

          // 예약번호 자동 생성
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const reservationCode = `CRD-${dateStr}-${randomStr}`;

          console.log('[Login] 3800: UserTrip 생성 데이터 준비 완료:', {
            userId: activeUser.id,
            productId: realProduct.id,
            reservationCode,
            cruiseName: `${realProduct.cruiseLine} ${realProduct.shipName}`,
            destinations: destinations,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            nights: realProduct.nights,
            days: realProduct.days,
            visitCount: destinations.length,
          });

          // UserTrip 생성
          const userTrip = await prisma.userTrip.create({
            data: {
              userId: activeUser.id,
              productId: realProduct.id,
              reservationCode,
              cruiseName: `${realProduct.cruiseLine} ${realProduct.shipName}`,
              companionType: '가족', // 기본값
              destination: destinations,
              startDate,
              endDate,
              nights: realProduct.nights,
              days: realProduct.days,
              visitCount: destinations.length,
              status: 'Upcoming',
              googleFolderId: 'auto-genie',
              spreadsheetId: 'auto-genie',
              updatedAt: new Date(),
            },
          });

          console.log('[Login] 3800: ✅ UserTrip 생성 성공:', {
            tripId: userTrip.id,
            userId: activeUser.id,
            cruiseName: `${realProduct.cruiseLine} ${realProduct.shipName}`,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            nights: realProduct.nights,
            days: realProduct.days,
          });

          // Itinerary 레코드들 자동 생성
          console.log('[Login] 3800: Itinerary 생성 시작:', {
            itineraryPatternLength: itineraryPattern.length,
            tripId: userTrip.id,
          });

          const itineraries = [];
          for (const pattern of itineraryPattern) {
            const dayDate = new Date(startDate);
            dayDate.setDate(dayDate.getDate() + pattern.day - 1);

            itineraries.push({
              userTripId: userTrip.id,
              day: pattern.day,
              date: dayDate,
              type: pattern.type,
              location: pattern.location || null,
              country: pattern.country || null,
              currency: pattern.currency || null,
              language: pattern.language || null,
              arrival: pattern.arrival || null,
              departure: pattern.departure || null,
              time: pattern.time || null,
              updatedAt: new Date(),
            });
          }

          console.log('[Login] 3800: Itinerary 데이터 준비 완료:', {
            count: itineraries.length,
            tripId: userTrip.id,
          });

          await prisma.itinerary.createMany({
            data: itineraries,
          });

          console.log('[Login] 3800: ✅ Itinerary 생성 완료:', {
            count: itineraries.length,
            tripId: userTrip.id,
          });

          // VisitedCountry 업데이트
          for (const [countryCode, countryInfo] of visitedCountries) {
            await prisma.visitedCountry.upsert({
              where: {
                userId_countryCode: {
                  userId: activeUser.id,
                  countryCode,
                },
              },
              update: {
                visitCount: { increment: 1 },
                lastVisited: startDate,
              },
              create: {
                userId: activeUser.id,
                countryCode,
                countryName: countryInfo.name,
                visitCount: 1,
                lastVisited: startDate,
              },
            });
          }

          console.log('[Login] 3800: ✅ REAL-CRUISE-01 폴백 UserTrip 생성 완료:', userTrip.id);
        } catch (tripError) {
          console.error('[Login] 3800: Failed to auto-create UserTrip:', tripError);
          console.error('[Login] 3800: UserTrip creation error details:', {
            error: tripError instanceof Error ? tripError.message : String(tripError),
            stack: tripError instanceof Error ? tripError.stack : undefined,
            name: tripError instanceof Error ? tripError.name : undefined,
            userId: activeUser.id,
            userName: activeUser.name || name,
          });

          // UserTrip 생성 실패 시에도 로그인은 계속 진행하되, 에러를 명확히 기록
        }
      } else if (existingUserTrip) {
        // 어드민이 등록한 UserTrip 보존 — 절대 덮어쓰지 않음
        console.log('[Login] 3800: 어드민 등록 UserTrip 보존:', {
          userId: activeUser.id,
          tripId: existingUserTrip.id,
          productId: existingUserTrip.productId,
        });
      } else if (!realProduct) {
        console.warn('[Login] 3800: REAL-CRUISE-01 상품 없음, UserTrip 폴백 생성 건너뜀');
      }

      const next = activeUser.onboarded ? '/chat' : '/onboarding'; // 온보딩 완료 여부 기반 분기
      const userId = activeUser.id;

      try {
        // 기존 세션 정리 (동시 로그인 방지 및 세션 테이블 정리)
        try {
          const deletedSessions = await prisma.session.deleteMany({
            where: { userId },
          });
          console.log('[Login] 3800 기존 세션 정리 완료:', { deletedCount: deletedSessions.count, userId });
        } catch (cleanupError) {
          console.warn('[Login] 3800 기존 세션 정리 실패 (무시하고 계속):', cleanupError);
        }

        // 세션 ID 생성 (32바이트 랜덤 값을 hex 문자열로)
        const sessionId = randomBytes(32).toString('hex');

        // CSRF 토큰 생성
        const csrfToken = generateCsrfToken();

        // 세션 만료 시간 설정 (30일)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // 세션 생성
        const session = await prisma.session.create({
          data: {
            id: sessionId,
            userId,
            csrfToken,
            expiresAt,
          },
          select: { id: true, csrfToken: true },
        });

        // 쿠키 심기
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE, session.id, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30일
          secure: process.env.NODE_ENV === 'production',
          domain: process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined,
        });

        // 로그인 성공 로그
        authLogger.loginSuccess(userId, clientIp);

        // 생애주기 관리: 백그라운드 처리 (응답 속도에 영향 없음)
        reactivateUser(userId).catch((e: unknown) => console.error('[Login] 재활성화 실패 (무시):', e));
        updateLastActive(userId).catch((e: unknown) => console.error('[Login] 활동 시각 업데이트 실패 (무시):', e));

        console.log('[Login] 활성 고객 로그인 완료:', { userId, phone, name });

        return NextResponse.json({
          ok: true,
          next,
          csrfToken: session.csrfToken,
        });
      } catch (sessionError) {
        console.error('[Login] 세션 생성 실패:', sessionError);
        throw sessionError;
      }
    }

    // user1~user10 크루즈몰 계정 체크 (비밀번호 1101)
    const isCruiseMallUser = phone && /^user(1[0]|[1-9])$/i.test(phone.trim());
    if (isCruiseMallUser && password === '1101') {
      console.log('[Login] 크루즈몰 계정 로그인 (user1~user10):', { phone, name });

      // 크루즈몰 계정 찾기 또는 생성
      let cruiseMallUser = await prisma.user.findFirst({
        where: {
          phone: phone.trim(),
          role: 'user',
        },
        select: {
          id: true,
          name: true,
          password: true,
          onboarded: true,
          loginCount: true,
          role: true,
          customerStatus: true,
          UserTrip: { select: { id: true }, take: 1 },
        },
      });

      if (!cruiseMallUser) {
        // 신규 생성
        const now = new Date();
        cruiseMallUser = await prisma.user.create({
          data: {
            phone: phone.trim(),
            name: name || phone.trim(),
            password: '1101',
            onboarded: false,
            loginCount: 1,
            role: 'user',
            customerStatus: 'active',
            customerSource: 'cruise-mall',
            updatedAt: now,
          },
          select: {
            id: true,
            name: true,
            password: true,
            onboarded: true,
            loginCount: true,
            role: true,
            customerStatus: true,
            UserTrip: { select: { id: true }, take: 1 },
          },
        });
        console.log('[Login] 크루즈몰 계정 생성 완료:', { userId: cruiseMallUser.id, phone });
      } else {
        // 기존 계정: 비밀번호가 1101이 아니면 업데이트
        if (cruiseMallUser.password !== '1101') {
          await prisma.user.update({
            where: { id: cruiseMallUser.id },
            data: { password: '1101' },
          });
          cruiseMallUser.password = '1101';
        }
        // 로그인 횟수 증가
        await prisma.user.update({
          where: { id: cruiseMallUser.id },
          data: { loginCount: { increment: 1 } },
        });
      }

      const userId = cruiseMallUser.id;
      const next = '/chat';

      // 기존 세션 정리
      try {
        const deletedSessions = await prisma.session.deleteMany({
          where: { userId },
        });
        console.log('[Login] 크루즈몰 계정 기존 세션 정리 완료:', { deletedCount: deletedSessions.count, userId });
      } catch (cleanupError) {
        console.warn('[Login] 크루즈몰 계정 기존 세션 정리 실패 (무시하고 계속):', cleanupError);
      }

      // 세션 생성
      const sessionId = randomBytes(32).toString('hex');
      const csrfToken = generateCsrfToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const session = await prisma.session.create({
        data: {
          id: sessionId,
          userId,
          csrfToken,
          expiresAt,
        },
        select: { id: true, csrfToken: true },
      });

      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, session.id, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined,
      });

      authLogger.loginSuccess(userId, clientIp);
      reactivateUser(userId).catch(() => {});
      updateLastActive(userId).catch(() => {});

      return NextResponse.json({
        ok: true,
        next,
        csrfToken: session.csrfToken,
      });
    }

    // 1) 기존 고객: 이름, 전화번호, 비밀번호, role(user) 4가지를 모두 확인
    // 같은 전화번호로 여러 계정이 있어도 정확히 매칭되는 계정만 반환됨
    // 비밀번호가 1101(테스트 모드), 3800이 아닌 경우에만 일반 로그인 처리
    // (user1~user10은 위에서 이미 처리됨)
    const existing = await prisma.user.findFirst({
      where: {
        phone,        // ✅ 전화번호 확인
        name,         // ✅ 이름 확인
        password,     // ✅ 비밀번호 확인
        role: 'user', // ✅ 일반 사용자 확인 (admin 제외)
      },
      select: {
        id: true,
        password: true,
        onboarded: true,
        loginCount: true,
        role: true,
        customerStatus: true,
        UserTrip: { select: { id: true, endDate: true }, orderBy: { endDate: 'desc' }, take: 1 },
      },
    });

    // 이름, 전화번호, 비밀번호가 일치하지만 role이 admin인 경우
    // (관리자 계정이 일반 로그인으로 접근하려는 경우)
    if (!existing) {
      // 관리자 계정인지 확인
      const adminCheck = await prisma.user.findFirst({
        where: {
          phone,
          name,
          password,
          role: 'admin',
        },
      });

      if (adminCheck) {
        console.log('[LOGIN] 관리자 계정으로 일반 사용자 로그인 시도:', { phone, name, userId: adminCheck.id });
        return NextResponse.json({
          ok: false,
          error: '관리자 계정입니다. 관리자 로그인 페이지를 이용해주세요.'
        }, { status: 403 });
      }
    }

    let userId: number;
    // 비밀번호 3800 = 크루즈 가이드 지니 (일반) → /chat으로 리다이렉트
    // 비밀번호 1101 = 크루즈 가이드 지니 3일 체험 → /chat-test로 리다이렉트 (위에서 이미 처리됨)
    let next = '/chat';

    if (existing) {
      // 기존 고객: 이미 4가지 조건(name, phone, password, role='user')을 모두 만족하는 계정
      // 비밀번호는 where 조건에서 이미 확인했으므로 추가 검증 불필요

      // @ts-ignore
      userId = existing.id as unknown as number;

      // 로그인 횟수 증가
      await prisma.user.update({
        where: { id: userId },
        data: { loginCount: { increment: 1 } },
      });

      const isActive = existing.customerStatus === 'active' || existing.customerStatus === null;

      // ── 서비스 만료 체크 (여행 종료 +1일) ──
      const latestTrip = existing.UserTrip[0];
      if (latestTrip?.endDate) {
        const serviceEnd = new Date(latestTrip.endDate);
        serviceEnd.setDate(serviceEnd.getDate() + 1);
        serviceEnd.setHours(23, 59, 59, 999);
        if (new Date() > serviceEnd) {
          return NextResponse.json({
            ok: false,
            error: '크루즈 여행이 종료되어 서비스 이용 기간이 만료되었습니다. 새 크루즈 예약 후 이용 가능합니다.',
          }, { status: 403 });
        }
      }

      // ── 온보딩 여부 기반 리다이렉트 ──
      // 처음 로그인 (onboarded=false) → /onboarding (여행 일정 확인 + 앱 소개)
      // 이후 로그인 (onboarded=true)  → /chat (오늘의 브리핑)
      next = existing.onboarded ? '/chat' : '/onboarding';

      console.log('[Login] 리다이렉트 결정:', {
        userId: existing.id,
        onboarded: existing.onboarded,
        customerStatus: existing.customerStatus,
        isActive,
        next,
      });
    } else {
      // 2) 신규 생성 → 온보딩 필요
      const now = new Date();
      const created = await prisma.user.create({
        data: {
          phone,
          name: name ?? null,
          password,        // 3800 등 내부 정책값. 클라이언트에 표시 X
          onboarded: false,
          loginCount: 1,   // 첫 로그인
          role: 'user',    // 명시적으로 user role 설정
          updatedAt: now,
        },
        select: { id: true },
      });
      // @ts-ignore
      userId = created.id as unknown as number;
      next = '/onboarding'; // 신규 고객은 항상 온보딩 먼저
    }

    // 기존 세션 정리 (동시 로그인 방지 및 세션 테이블 정리)
    try {
      const deletedSessions = await prisma.session.deleteMany({
        where: { userId },
      });
      console.log('[Login] 일반 로그인 기존 세션 정리 완료:', { deletedCount: deletedSessions.count, userId });
    } catch (cleanupError) {
      console.warn('[Login] 일반 로그인 기존 세션 정리 실패 (무시하고 계속):', cleanupError);
    }

    // 3) 세션 ID 생성 (32바이트 랜덤 값을 hex 문자열로)
    const sessionId = randomBytes(32).toString('hex');

    // 4) CSRF 토큰 생성
    const csrfToken = generateCsrfToken();

    // 5) 세션 만료 시간 설정 (30일)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 6) 세션 생성 (CSRF 토큰 및 만료 시간 포함)
    const session = await prisma.session.create({
      data: {
        id: sessionId,  // ✅ 세션 ID 필수
        userId,
        csrfToken,
        expiresAt,
      },
      select: { id: true, csrfToken: true },
    });

    // 7) 쿠키 심기
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30일
      secure: process.env.NODE_ENV === 'production',
      domain: process.env.NODE_ENV === 'production' ? '.cruiseai.co.kr' : undefined,
    });

    // 로그인 성공 로그
    authLogger.loginSuccess(userId, clientIp);

    // 생애주기 관리: 백그라운드 처리 (응답 속도에 영향 없음)
    reactivateUser(userId).catch(() => {});
    updateLastActive(userId).catch(() => {});

    // 최종 안전장치: 비밀번호 기반 리다이렉트 경로 확인
    // 비밀번호 1101 = 3일 체험 → /chat-test (강제)
    // 비밀번호 3800 = 일반 구매자 → onboarded 여부에 따라 /onboarding 또는 /chat (위에서 결정됨)
    if (password === '1101') {
      next = '/chat-test';
      console.log('[Login] 비밀번호 1101 - /chat-test');
    } else if (password === '3800') {
      // onboarding 체크는 위에서 이미 결정됨 (next = '/onboarding' or '/chat')
      // next를 그대로 유지 (override 하지 않음)
      console.log('[Login] 비밀번호 3800 - 리다이렉트:', next);
    }

    return NextResponse.json({
      ok: true,
      next,
      csrfToken: session.csrfToken, // 클라이언트에 CSRF 토큰 전달
    });
  } catch (e) {
    console.error('[Auth Login] Internal Error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    const errorStack = e instanceof Error ? e.stack : undefined;
    console.error('[Auth Login] Error details:', {
      errorMessage,
      errorStack,
      errorName: e instanceof Error ? e.name : 'Unknown',
      errorCause: e instanceof Error && 'cause' in e ? (e as any).cause : undefined,
    });

    return NextResponse.json(
      {
        ok: false,
        error: '로그인 실패',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
