export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DEFAULT_CONTRACT_TEMPLATES } from '@/lib/affiliate/contract-templates-data';

// 커스텀 계약서 타입 키
const CUSTOM_CONTRACT_TYPES_KEY = 'custom_contract_types';

/**
 * 공개 API: 사용 가능한 계약서 타입 목록 조회
 * 계약서 발송, 계약서 작성 페이지 등에서 사용
 */
export async function GET() {
  try {
    // 커스텀 계약서 타입 로드
    let customTypes: string[] = [];
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { configKey: CUSTOM_CONTRACT_TYPES_KEY },
      });
      if (config?.configValue) {
        customTypes = JSON.parse(config.configValue);
      }
    } catch (e) {
      console.error('[Contract Types API] Failed to load custom types:', e);
    }

    // 모든 계약서 템플릿 로드
    const configs = await prisma.systemConfig.findMany({
      where: {
        configKey: {
          startsWith: 'contract_template_',
        },
      },
    });

    // 계약서 타입 정보 구성
    const contractTypes: Array<{
      code: string;
      title: string;
      price?: string;
      icon: string;
      description?: string;
      isCustom: boolean;
      isDefault: boolean;
    }> = [];

    // 기본 계약서 타입 추가
    for (const [code, template] of Object.entries(DEFAULT_CONTRACT_TEMPLATES)) {
      // 저장된 템플릿이 있으면 병합
      const savedConfig = configs.find((c) => c.configKey === `contract_template_${code}`);
      let finalTemplate = template;
      
      if (savedConfig?.configValue) {
        try {
          const saved = JSON.parse(savedConfig.configValue);
          finalTemplate = { ...template, ...saved };
        } catch (e) {
          // 파싱 실패 시 기본값 사용
        }
      }

      contractTypes.push({
        code,
        title: finalTemplate.title,
        price: (finalTemplate as any).price,
        icon: (finalTemplate as any).icon || getDefaultIcon(code),
        description: (finalTemplate as any).description,
        isCustom: false,
        isDefault: true,
      });
    }

    // 커스텀 계약서 타입 추가
    for (const code of customTypes) {
      if (DEFAULT_CONTRACT_TEMPLATES[code]) continue; // 이미 추가된 기본 타입은 스킵

      const savedConfig = configs.find((c) => c.configKey === `contract_template_${code}`);
      if (savedConfig?.configValue) {
        try {
          const saved = JSON.parse(savedConfig.configValue);
          contractTypes.push({
            code,
            title: saved.title || code,
            price: saved.price,
            icon: saved.icon || '📄',
            description: saved.description,
            isCustom: true,
            isDefault: false,
          });
        } catch (e) {
          // 파싱 실패 시 기본값 사용
          contractTypes.push({
            code,
            title: code,
            icon: '📄',
            isCustom: true,
            isDefault: false,
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      contractTypes,
      count: contractTypes.length,
    });
  } catch (error: any) {
    console.error('[Contract Types API] Error:', error);
    return NextResponse.json(
      { ok: false, message: '계약서 타입 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function getDefaultIcon(code: string): string {
  const icons: Record<string, string> = {
    AFFILIATE: '📜',
    BRANCH_MANAGER: '🏢',
    SALES_AGENT: '👤',
    CRUISE_STAFF: '🚢',
  };
  return icons[code] || '📄';
}


