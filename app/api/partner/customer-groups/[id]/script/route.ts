export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { buildScopedGroupWhere, getTeamAgentIds } from '@/app/api/partner/customer-groups/utils';

// GET: 그룹별 스크립트 생성 (PartnerCustomerGroup 사용)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const groupId = parseInt(resolvedParams.id);
    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    // 판매원/대리점장 프로필 확인
    const affiliateProfile = await prisma.affiliateProfile.findFirst({
      where: {
        userId: user.id,
      },
      select: { id: true, type: true, status: true },
    });

    if (!affiliateProfile || !affiliateProfile.id) {
      return NextResponse.json({ ok: false, error: 'Affiliate profile not found' }, { status: 404 });
    }

    // 대리점장인 경우 팀 판매원 ID 목록 조회
    const teamAgentIds = await getTeamAgentIds(affiliateProfile.id, affiliateProfile.type || '');

    // 그룹 소유권 확인 (PartnerCustomerGroup) - 대리점장은 팀 판매원 그룹도 접근 가능
    const where = buildScopedGroupWhere(groupId, affiliateProfile.id, teamAgentIds);
    const group = await prisma.partnerCustomerGroup.findFirst({
      where,
      select: { id: true, name: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 기본 URL (환경 변수 또는 기본값 사용)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

    // 그룹에 연결된 랜딩페이지 찾기
    let landingPage = await prisma.landingPage.findFirst({
      where: {
        groupId: groupId,
        isActive: true,
        isPublic: true,
        adminId: user.id, // 관리자 ID로 필터링
      },
      select: { id: true, slug: true, title: true },
      orderBy: { createdAt: 'desc' },
    });

    // 랜딩페이지가 없으면 자동 생성
    if (!landingPage) {
      landingPage = await prisma.landingPage.create({
        data: {
          adminId: user.id,
          title: `${group.name} 그룹 등록 폼`,
          slug: `partner-group-${groupId}-${Date.now()}`, // 고유한 slug 생성
          htmlContent: `<h1>${group.name} 등록</h1><p>이름과 연락처를 입력해주세요.</p>`,
          groupId: groupId,
          isActive: true,
          isPublic: true,
          updatedAt: new Date(),
        },
        select: { id: true, slug: true, title: true },
      });
    }

    const landingPageSlug = landingPage.slug;

    // HTML 스크립트 생성
    const script = `<!-- ${group.name} 그룹 등록 폼 -->
<div id="cg-group-${groupId}-form" style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <form id="cg-group-${groupId}-registration-form" style="display: flex; flex-direction: column; gap: 15px;">
    <div>
      <label for="cg-name-${groupId}" style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">이름 *</label>
      <input
        type="text"
        id="cg-name-${groupId}"
        name="name"
        required
        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;"
      />
    </div>
    <div>
      <label for="cg-phone-${groupId}" style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">연락처 *</label>
      <input
        type="tel"
        id="cg-phone-${groupId}"
        name="phone"
        required
        placeholder="010-1234-5678"
        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;"
      />
    </div>
    <div>
      <label for="cg-email-${groupId}" style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">이메일 (선택)</label>
      <input
        type="email"
        id="cg-email-${groupId}"
        name="email"
        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;"
      />
    </div>
    <button
      type="submit"
      id="cg-submit-${groupId}"
      style="padding: 12px 24px; background-color: #3B82F6; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
      onmouseover="this.style.backgroundColor='#2563EB'"
      onmouseout="this.style.backgroundColor='#3B82F6'"
    >
      등록하기
    </button>
    <div id="cg-message-${groupId}" style="margin-top: 10px; display: none; padding: 10px; border-radius: 6px; font-size: 14px;"></div>
  </form>
</div>

<script>
(function() {
  const form = document.getElementById('cg-group-${groupId}-registration-form');
  const submitBtn = document.getElementById('cg-submit-${groupId}');
  const messageDiv = document.getElementById('cg-message-${groupId}');

  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('cg-name-${groupId}').value.trim();
    const phone = document.getElementById('cg-phone-${groupId}').value.trim();
    const email = document.getElementById('cg-email-${groupId}').value.trim();

    if (!name || !phone) {
      showMessage('이름과 연락처는 필수입니다.', 'error');
      return;
    }

    // 버튼 비활성화
    submitBtn.disabled = true;
    submitBtn.textContent = '등록 중...';
    messageDiv.style.display = 'none';

    try {
      const response = await fetch('${baseUrl}/api/public/landing-pages/${landingPageSlug}/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, phone, email: email || undefined }),
      });

      const data = await response.json();

      if (data.ok) {
        showMessage('등록이 완료되었습니다!', 'success');
        form.reset();

        // 완료 페이지로 리다이렉트 (있는 경우)
        if (data.completionUrl) {
          setTimeout(() => {
            window.location.href = data.completionUrl;
          }, 1500);
        }
      } else {
        showMessage(data.error || '등록에 실패했습니다. 다시 시도해주세요.', 'error');
      }
    } catch (error) {
      showMessage('네트워크 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '등록하기';
    }
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.style.display = 'block';
    messageDiv.style.backgroundColor = type === 'success' ? '#D1FAE5' : '#FEE2E2';
    messageDiv.style.color = type === 'success' ? '#065F46' : '#991B1B';
  }
})();
</script>`;

    return NextResponse.json({
      ok: true,
      group: {
        id: group.id,
        name: group.name,
      },
      script,
      landingPageSlug,
      instructions: `이 스크립트를 HTML 페이지에 삽입하세요.
폼 제출 시 자동으로 '${group.name}' 그룹에 고객이 추가되며,
연결된 예약 메시지가 자동으로 활성화됩니다.`,
    });
  } catch (error) {
    console.error('[Partner Customer Groups Script GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '스크립트 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
