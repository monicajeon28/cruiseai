export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { syncApisInBackground } from '@/lib/google-sheets';

// 파트너 권한 확인 (판매원, 대리점장, 관리자)
async function checkPartnerAccessByTraveler(userId: number, travelerId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  // 관리자는 모든 접근 허용
  if (user?.role === 'admin' || user?.role === 'superadmin') {
    return true;
  }

  // 파트너 프로필 확인
  const profile = await prisma.affiliateProfile.findFirst({
    where: { userId },
    select: { id: true, type: true },
  });

  if (!profile) return false;

  // 여행자 → 예약 → AffiliateSale 확인
  const traveler = await prisma.traveler.findUnique({
    where: { id: travelerId },
    select: {
      Reservation: {
        select: { affiliateSaleId: true }
      }
    },
  });

  if (!traveler?.Reservation?.affiliateSaleId) return false;

  const sale = await prisma.affiliateSale.findUnique({
    where: { id: traveler.Reservation.affiliateSaleId },
    select: { affiliateId: true, managerId: true },
  });

  if (!sale) return false;

  // 판매원 본인 또는 대리점장(매니저)
  return sale.affiliateId === profile.id || sale.managerId === profile.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { travelerId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const travelerId = parseInt(params.travelerId);
    if (isNaN(travelerId)) {
      return NextResponse.json({ ok: false, error: 'Invalid traveler ID' }, { status: 400 });
    }

    // 파트너 권한 확인
    const hasAccess = await checkPartnerAccessByTraveler(Number(session.userId), travelerId);
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      korName,
      engSurname,
      engGivenName,
      passportNo,
      nationality,
      birthDate,
      issueDate,
      expiryDate,
      gender,
      residentNum,
      phone,
      roomNumber,
      notes,
    } = body;

    // 여행자 존재 여부 확인
    const existingTraveler = await prisma.traveler.findUnique({
      where: { id: travelerId },
    });

    if (!existingTraveler) {
      return NextResponse.json({ ok: false, error: 'Traveler not found' }, { status: 404 });
    }

    // 업데이트 데이터 구성
    const updateData: any = {};
    if (korName !== undefined) updateData.korName = korName || null;
    if (engSurname !== undefined) updateData.engSurname = engSurname?.toUpperCase() || null;
    if (engGivenName !== undefined) updateData.engGivenName = engGivenName?.toUpperCase() || null;
    if (passportNo !== undefined) updateData.passportNo = passportNo?.toUpperCase() || null;
    if (nationality !== undefined) updateData.nationality = nationality?.toUpperCase() || null;
    if (birthDate !== undefined) updateData.birthDate = birthDate || null;
    if (issueDate !== undefined) updateData.issueDate = issueDate || null;
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate || null;
    if (gender !== undefined) updateData.gender = gender || null;
    if (residentNum !== undefined) updateData.residentNum = residentNum || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (roomNumber !== undefined) updateData.roomNumber = roomNumber || null;
    if (notes !== undefined) updateData.notes = notes || null;

    // 여행자 정보 업데이트
    const updatedTraveler = await prisma.traveler.update({
      where: { id: travelerId },
      data: updateData,
      include: {
        Reservation: {
          select: {
            Trip: { select: { id: true } }
          }
        }
      }
    });

    // APIS 스프레드시트 자동 동기화 (재시도 로직 포함)
    const tripId = updatedTraveler.Reservation?.Trip?.id;
    if (tripId) {
      syncApisInBackground(tripId);
    }

    return NextResponse.json({
      ok: true,
      traveler: {
        id: updatedTraveler.id,
        korName: updatedTraveler.korName,
        engSurname: updatedTraveler.engSurname,
        engGivenName: updatedTraveler.engGivenName,
        passportNo: updatedTraveler.passportNo,
        nationality: updatedTraveler.nationality,
        birthDate: updatedTraveler.birthDate,
        issueDate: updatedTraveler.issueDate,
        expiryDate: updatedTraveler.expiryDate,
        gender: updatedTraveler.gender,
        residentNum: updatedTraveler.residentNum,
        phone: updatedTraveler.phone,
        roomNumber: updatedTraveler.roomNumber,
        notes: updatedTraveler.notes,
      },
    });
  } catch (error: any) {
    console.error('[Partner Travelers Update] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update traveler' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { travelerId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const travelerId = parseInt(params.travelerId);
    if (isNaN(travelerId)) {
      return NextResponse.json({ ok: false, error: 'Invalid traveler ID' }, { status: 400 });
    }

    // 파트너 권한 확인
    const hasAccess = await checkPartnerAccessByTraveler(Number(session.userId), travelerId);
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // 여행자 존재 여부 확인 및 tripId 가져오기
    const existingTraveler = await prisma.traveler.findUnique({
      where: { id: travelerId },
      include: {
        Reservation: {
          select: {
            id: true,
            Trip: { select: { id: true } }
          }
        }
      }
    });

    if (!existingTraveler) {
      return NextResponse.json({ ok: false, error: 'Traveler not found' }, { status: 404 });
    }

    const reservationId = existingTraveler.reservationId;
    const tripId = existingTraveler.Reservation?.Trip?.id;

    // 여행자 삭제
    await prisma.traveler.delete({
      where: { id: travelerId },
    });

    // 예약의 총 인원 수 업데이트
    if (reservationId) {
      const travelerCount = await prisma.traveler.count({
        where: { reservationId },
      });

      await prisma.reservation.update({
        where: { id: reservationId },
        data: { totalPeople: travelerCount },
      });
    }

    // APIS 스프레드시트 자동 동기화 (재시도 로직 포함)
    if (tripId) {
      syncApisInBackground(tripId);
    }

    return NextResponse.json({
      ok: true,
      message: 'Traveler deleted successfully',
    });
  } catch (error: any) {
    console.error('[Partner Travelers Delete] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete traveler' },
      { status: 500 }
    );
  }
}
