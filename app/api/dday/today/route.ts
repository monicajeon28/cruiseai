export const dynamic = 'force-dynamic';

// app/api/dday/today/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/(server)/session';
import prisma from '@/lib/prisma';
import { getDdayMessage, getEnddayMessage } from '@/app/(server)/dday';

export async function GET() {
  const s = await getServerSession();
  if (!s?.userId) return NextResponse.json({ ok:true, dday:null, end:null });

  const user = await prisma.user.findUnique({ where:{ id:s.userId }, select:{ name:true, phone:true } });
  const trip = await prisma.trip.findFirst({
    where:{ userId:s.userId }, orderBy:{ createdAt:'desc' },
    select:{ cruiseName:true, destination:true, startDate:true, endDate:true }
  });

  if (!user || !trip) return NextResponse.json({ ok:true, dday:null, end:null });

  const base = {
    customerName: user.name ?? '고객',
    cruiseName: trip.cruiseName ?? undefined,
    destination: Array.isArray(trip.destination) ? trip.destination.join(' · ') : (trip.destination ?? undefined),
    customerPhone: user.phone ?? undefined,
  };

  const dday = trip.startDate ? await getDdayMessage({ ...base, startDateISO: trip.startDate as any }) : null;
  const end  = trip.endDate   ? await getEnddayMessage({ ...base, endDateISO:   trip.endDate as any }) : null;

  return NextResponse.json({ ok:true, dday, end });
}
