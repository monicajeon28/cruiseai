// 인증서 승인 관련 알림 생성 유틸리티
import prisma from '@/lib/prisma';

/**
 * 승인 요청 시 관리자에게 알림 발송
 */
export async function notifyAdminOfApprovalRequest(approvalId: number) {
  try {
    const approval = await prisma.certificateApproval.findUnique({
      where: { id: approvalId },
      include: {
        Requester: {
          select: {
            name: true,
            AffiliateProfile: {
              select: {
                type: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!approval) return;

    const certificateTypeName = approval.certificateType === 'purchase' ? '구매확인증서' : '환불인증서';
    const requesterRole = approval.Requester.AffiliateProfile?.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원';

    // 모든 관리자에게 알림
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true },
    });

    const notifications = admins.map((admin) => ({
      userId: admin.id,
      notificationType: 'certificate_approval_request',
      title: `${certificateTypeName} 승인 요청`,
      content: `${requesterRole} ${approval.Requester.name}님이 ${approval.customerName} 고객의 ${certificateTypeName} 승인을 요청했습니다.`,
      priority: 'high',
      metadata: {
        approvalId: approval.id,
        certificateType: approval.certificateType,
        requesterId: approval.requesterId,
        customerName: approval.customerName,
        link: '/admin/documents?tab=approvals',
      },
    }));

    await prisma.adminNotification.createMany({
      data: notifications,
    });

    console.log('[Notification] Approval request notified to', admins.length, 'admins');
  } catch (error) {
    console.error('[Notification] Failed to notify admins:', error);
  }
}

/**
 * 승인 완료 시 요청자에게 알림 발송
 */
export async function notifyRequesterOfApproval(approvalId: number) {
  try {
    const approval = await prisma.certificateApproval.findUnique({
      where: { id: approvalId },
      include: {
        Approver: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!approval || !approval.approvedBy) return;

    const certificateTypeName = approval.certificateType === 'purchase' ? '구매확인증서' : '환불인증서';

    await prisma.adminNotification.create({
      data: {
        userId: approval.requesterId,
        notificationType: 'certificate_approved',
        title: `${certificateTypeName} 승인 완료`,
        content: `${approval.customerName} 고객의 ${certificateTypeName}가 승인되었습니다. 이제 다운로드할 수 있습니다.`,
        priority: 'normal',
        metadata: {
          approvalId: approval.id,
          certificateType: approval.certificateType,
          approverId: approval.approvedBy,
          approverName: approval.Approver?.name,
          customerName: approval.customerName,
          link: '/partner/documents',
        },
      },
    });

    console.log('[Notification] Approval notified to requester:', approval.requesterId);
  } catch (error) {
    console.error('[Notification] Failed to notify requester:', error);
  }
}

/**
 * 승인 거부 시 요청자에게 알림 발송
 */
export async function notifyRequesterOfRejection(approvalId: number) {
  try {
    const approval = await prisma.certificateApproval.findUnique({
      where: { id: approvalId },
      include: {
        Approver: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!approval || !approval.approvedBy) return;

    const certificateTypeName = approval.certificateType === 'purchase' ? '구매확인증서' : '환불인증서';

    await prisma.adminNotification.create({
      data: {
        userId: approval.requesterId,
        notificationType: 'certificate_rejected',
        title: `${certificateTypeName} 승인 거부`,
        content: `${approval.customerName} 고객의 ${certificateTypeName} 승인이 거부되었습니다.${approval.rejectedReason ? ` 사유: ${approval.rejectedReason}` : ''}`,
        priority: 'high',
        metadata: {
          approvalId: approval.id,
          certificateType: approval.certificateType,
          approverId: approval.approvedBy,
          approverName: approval.Approver?.name,
          customerName: approval.customerName,
          rejectedReason: approval.rejectedReason,
          link: '/partner/documents',
        },
      },
    });

    console.log('[Notification] Rejection notified to requester:', approval.requesterId);
  } catch (error) {
    console.error('[Notification] Failed to notify requester:', error);
  }
}

