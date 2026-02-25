export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 기본 계약서 템플릿 텍스트
const DEFAULT_TEMPLATES: Record<string, {
  title: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
  }>;
}> = {
  BRANCH_MANAGER: {
    title: '대리점장 계약서',
    sections: [
      {
        id: 'intro',
        title: '계약 안내',
        content: '본 계약서는 크루즈닷(이하 "회사")과 대리점장(이하 "을") 간의 업무 위탁 계약에 관한 내용입니다.',
      },
      {
        id: 'terms',
        title: '계약 조건',
        content: '1. 대리점장은 회사의 상품을 판매하고 판매원을 모집할 수 있는 권한을 부여받습니다.\n2. 대리점장은 판매 실적에 따른 커미션과 하위 판매원의 판매에 대한 오버라이드 커미션을 받습니다.\n3. 계약 기간은 1년이며, 양측의 서면 통지 없이 자동 갱신됩니다.',
      },
      {
        id: 'commission',
        title: '수당 안내',
        content: '1. 직접 판매 수당: 판매 금액의 20%\n2. 오버라이드 수당: 하위 판매원 판매 금액의 5%\n3. 정산일: 매월 15일 (전월 실적 기준)',
      },
      {
        id: 'obligations',
        title: '의무 사항',
        content: '1. 회사의 브랜드 이미지를 손상시키는 행위 금지\n2. 고객 개인정보 보호 의무 준수\n3. 허위 광고 및 과장 광고 금지',
      },
      {
        id: 'penalty',
        title: '위약금 조항',
        content: '계약 기간 내 일방적인 해지 시 위약금이 발생할 수 있습니다.',
      },
    ],
  },
  SALES_AGENT: {
    title: '판매원 계약서',
    sections: [
      {
        id: 'intro',
        title: '계약 안내',
        content: '본 계약서는 크루즈닷(이하 "회사")과 판매원(이하 "을") 간의 업무 위탁 계약에 관한 내용입니다.',
      },
      {
        id: 'terms',
        title: '계약 조건',
        content: '1. 판매원은 회사의 상품을 판매할 수 있는 권한을 부여받습니다.\n2. 판매원은 판매 실적에 따른 커미션을 받습니다.\n3. 계약 기간은 1년이며, 양측의 서면 통지 없이 자동 갱신됩니다.',
      },
      {
        id: 'commission',
        title: '수당 안내',
        content: '1. 직접 판매 수당: 판매 금액의 15%\n2. 정산일: 매월 15일 (전월 실적 기준)',
      },
      {
        id: 'obligations',
        title: '의무 사항',
        content: '1. 회사의 브랜드 이미지를 손상시키는 행위 금지\n2. 고객 개인정보 보호 의무 준수\n3. 허위 광고 및 과장 광고 금지',
      },
      {
        id: 'penalty',
        title: '위약금 조항',
        content: '계약 기간 내 일방적인 해지 시 위약금이 발생할 수 있습니다.',
      },
    ],
  },
  CRUISE_STAFF: {
    title: '크루즈스탭 계약서',
    sections: [
      {
        id: 'intro',
        title: '계약 안내',
        content: '본 계약서는 크루즈닷(이하 "회사")과 크루즈스탭(이하 "을") 간의 업무 위탁 계약에 관한 내용입니다.',
      },
      {
        id: 'terms',
        title: '계약 조건',
        content: '1. 크루즈스탭은 크루즈 선상에서 회사의 상품을 홍보하고 판매할 수 있는 권한을 부여받습니다.\n2. 크루즈스탭은 판매 실적에 따른 커미션을 받습니다.\n3. 계약 기간은 승선 기간 동안 유효합니다.',
      },
      {
        id: 'commission',
        title: '수당 안내',
        content: '1. 직접 판매 수당: 판매 금액의 18%\n2. 정산일: 하선 후 15일 이내',
      },
      {
        id: 'obligations',
        title: '의무 사항',
        content: '1. 회사의 브랜드 이미지를 손상시키는 행위 금지\n2. 고객 개인정보 보호 의무 준수\n3. 승선 규정 준수',
      },
      {
        id: 'penalty',
        title: '위약금 조항',
        content: '계약 기간 내 일방적인 해지 시 위약금이 발생할 수 있습니다.',
      },
    ],
  },
  SUBSCRIPTION_AGENT: {
    title: '정액제 판매원 계약서',
    sections: [
      {
        id: 'intro',
        title: '계약 안내',
        content: '본 계약서는 크루즈닷(이하 "회사")과 정액제 판매원(이하 "을") 간의 서비스 이용 계약에 관한 내용입니다.',
      },
      {
        id: 'terms',
        title: '계약 조건',
        content: '1. 정액제 판매원은 월정액 결제 후 크루즈가이드 지니 서비스를 이용할 수 있습니다.\n2. 7일 무료 체험 후 자동 결제가 진행됩니다.\n3. 매월 동일 날짜에 자동 결제됩니다.',
      },
      {
        id: 'service',
        title: '서비스 내용',
        content: '1. 크루즈가이드 지니 AI 챗봇 무제한 사용\n2. 일정 관리 및 여행 도구 사용\n3. 판매 페이지 제공\n4. 고객 관리 기능',
      },
      {
        id: 'payment',
        title: '결제 안내',
        content: '1. 월정액: 100,000원 (VAT 포함)\n2. 결제 방법: 신용카드/체크카드\n3. 결제일: 가입일 기준 매월 동일 날짜',
      },
      {
        id: 'cancellation',
        title: '해지 안내',
        content: '1. 언제든지 해지가 가능합니다.\n2. 해지 시 다음 결제일부터 서비스가 중지됩니다.\n3. 이미 결제된 금액은 환불되지 않습니다.',
      },
    ],
  },
};

/**
 * 공개 API: 계약서 템플릿 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const contractType = type.toUpperCase();

    if (!DEFAULT_TEMPLATES[contractType]) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 계약서 타입입니다.' },
        { status: 404 }
      );
    }

    // SystemConfig에서 저장된 템플릿 가져오기
    const config = await prisma.systemConfig.findUnique({
      where: { configKey: `contract_template_${contractType}` },
    });

    let template = DEFAULT_TEMPLATES[contractType];

    if (config && config.configValue) {
      try {
        const savedTemplate = JSON.parse(config.configValue);
        template = {
          ...DEFAULT_TEMPLATES[contractType],
          ...savedTemplate,
        };
      } catch (e) {
        console.error(`[Contract Template] Failed to parse template for ${contractType}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      template,
    });
  } catch (error: any) {
    console.error('[Contract Template GET] Error:', error);
    return NextResponse.json(
      { ok: false, message: error?.message || '템플릿 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

