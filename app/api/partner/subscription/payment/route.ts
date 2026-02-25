export const dynamic = 'force-dynamic';

// app/api/partner/subscription/payment/route.ts
// 정액제 판매원 PayApp 결제 요청 API

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { payappApiPost, getContractPrice, getContractGoodName } from '@/lib/payapp';
import prisma from '@/lib/prisma';
import { log, error } from '@/lib/logger-wrapper';

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 결제 전 이름, 연락처 정보 받기
    const { name, phone } = await req.json().catch(() => ({}));

    // 정액제 계약서 확인
    const contract = await prisma.affiliateContract.findFirst({
      where: {
        mallUserId: (sessionUser as any).mallUserId,
        metadata: {
          path: ['contractType'],
          equals: 'SUBSCRIPTION_AGENT',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '정액제 계약서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이름, 연락처 정보를 계약서 메타데이터에 저장
    if (name || phone) {
      const metadata = contract.metadata as any || {};
      metadata.userInfo = {
        name: name || sessionUser.name || contract.name,
        phone: phone || sessionUser.phone || contract.phone,
      };

      await prisma.affiliateContract.update({
        where: { id: contract.id },
        data: {
          metadata: metadata,
          name: name || contract.name,
          phone: phone || contract.phone,
        },
      });
    }

    // 관리자 패널에 저장된 PayApp 설정 사용 (환경변수로 동기화됨)
    const payappUserid = process.env.PAYAPP_USERID;
    const payappLinkkey = process.env.PAYAPP_LINKKEY;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

    if (!payappUserid || !payappLinkkey) {
      error('[Subscription Payment] PayApp 설정 누락');
      return NextResponse.json(
        { ok: false, message: 'PayApp 설정이 완료되지 않았습니다. 관리자 패널에서 PayApp 설정을 확인하고 저장해주세요.' },
        { status: 500 }
      );
    }

    const price = getContractPrice('SUBSCRIPTION_AGENT');
    const goodname = getContractGoodName('SUBSCRIPTION_AGENT');

    if (price === 0) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 결제 정보입니다.' },
        { status: 400 }
      );
    }

    // 결제 요청 파라메터
    const params = {
      cmd: 'payrequest',
      userid: payappUserid,
      goodname: `${goodname} - ${sessionUser.name || (sessionUser as any).mallUserId || '정액제 판매원'}`,
      price: price,
      recvphone: (sessionUser.phone || '').replace(/[^0-9]/g, ''), // 숫자만 추출
      memo: `${goodname} 결제`,
      reqaddr: 0,
      feedbackurl: `${baseUrl}/api/payapp/feedback`,
      var1: String(contract.id), // 계약서 ID
      var2: 'SUBSCRIPTION_AGENT', // 계약서 타입
      smsuse: 'n', // SMS 발송 안함
      returnurl: `${baseUrl}/partner/${(sessionUser as any).mallUserId || sessionUser.phone}/dashboard?payment=success`,
      openpaytype: 'card', // 카드번호 입력 결제만
      checkretry: 'y', // feedbackurl 재시도
      skip_cstpage: 'y', // 매출전표 페이지 이동 안함
    };

    log('[Subscription Payment] 결제 요청 파라메터:', {
      cmd: params.cmd,
      userid: params.userid,
      goodname: params.goodname,
      price: params.price,
      recvphone: params.recvphone,
      feedbackurl: params.feedbackurl,
      returnurl: params.returnurl,
    });

    const result = await payappApiPost(params);

    log('[Subscription Payment] PayApp 응답:', result);

    if (result.state === '1') {
      // 결제 요청 성공
      log('[Subscription Payment] 결제 요청 성공:', {
        mul_no: result.mul_no,
        payurl: result.payurl,
      });
      return NextResponse.json({
        ok: true,
        mul_no: result.mul_no,
        payurl: result.payurl,
        qrurl: result.qrurl,
      });
    } else {
      // 결제 요청 실패
      error('[Subscription Payment] 결제 요청 실패:', {
        state: result.state,
        errorMessage: result.errorMessage,
        errno: result.errno,
      });
      return NextResponse.json(
        {
          ok: false,
          message: result.errorMessage || '결제 요청에 실패했습니다.',
          errno: result.errno,
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    error('[Subscription Payment] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
