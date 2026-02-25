// prisma/seed-cruise-products.ts
// CruiseProduct 테스트 데이터 생성 스크립트

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚢 Creating CruiseProduct test data...');

  // 1. MSC 벨리시마 - 일본/대만 4박 5일
  const product1 = await prisma.cruiseProduct.upsert({
    where: { productCode: 'MSC-JP4N5D' },
    update: {},
    create: {
      productCode: 'MSC-JP4N5D',
      cruiseLine: 'MSC 크루즈',
      shipName: 'MSC 벨리시마',
      packageName: '일본/대만 4박 5일',
      nights: 4,
      days: 5,
      basePrice: 1200000,
      description: '부산 출발 후쿠오카, 타이베이를 경유하는 4박 5일 크루즈 여행',
      itineraryPattern: [
        {
          day: 1,
          type: 'Embarkation',
          location: 'Busan',
          country: 'KR',
          currency: 'KRW',
          language: 'ko',
          time: '14:00',
        },
        {
          day: 2,
          type: 'PortVisit',
          location: 'Fukuoka',
          country: 'JP',
          currency: 'JPY',
          language: 'ja',
          arrival: '08:00',
          departure: '18:00',
        },
        {
          day: 3,
          type: 'Cruising',
        },
        {
          day: 4,
          type: 'PortVisit',
          location: 'Taipei',
          country: 'TW',
          currency: 'TWD',
          language: 'zh-TW',
          arrival: '09:00',
          departure: '19:00',
        },
        {
          day: 5,
          type: 'Disembarkation',
          location: 'Busan',
          country: 'KR',
          currency: 'KRW',
          language: 'ko',
          time: '09:00',
        },
      ],
      updatedAt: new Date(),
    },
  });

  // 2. Royal Caribbean - 일본 규슈 3박 4일
  const product2 = await prisma.cruiseProduct.upsert({
    where: { productCode: 'RC-JP3N4D' },
    update: {},
    create: {
      productCode: 'RC-JP3N4D',
      cruiseLine: 'Royal Caribbean',
      shipName: 'Spectrum of the Seas',
      packageName: '일본 규슈 3박 4일',
      nights: 3,
      days: 4,
      basePrice: 980000,
      description: '인천 출발 후쿠오카, 나가사키를 경유하는 3박 4일 크루즈',
      itineraryPattern: [
        {
          day: 1,
          type: 'Embarkation',
          location: 'Incheon',
          country: 'KR',
          currency: 'KRW',
          language: 'ko',
          time: '16:00',
        },
        {
          day: 2,
          type: 'PortVisit',
          location: 'Fukuoka',
          country: 'JP',
          currency: 'JPY',
          language: 'ja',
          arrival: '07:00',
          departure: '17:00',
        },
        {
          day: 3,
          type: 'PortVisit',
          location: 'Nagasaki',
          country: 'JP',
          currency: 'JPY',
          language: 'ja',
          arrival: '08:00',
          departure: '18:00',
        },
        {
          day: 4,
          type: 'Disembarkation',
          location: 'Incheon',
          country: 'KR',
          currency: 'KRW',
          language: 'ko',
          time: '08:00',
        },
      ],
      updatedAt: new Date(),
    },
  });

  // 3. Costa - 오키나와 5박 6일
  const product3 = await prisma.cruiseProduct.upsert({
    where: { productCode: 'COSTA-OKINAWA5N6D' },
    update: {},
    create: {
      productCode: 'COSTA-OKINAWA5N6D',
      cruiseLine: 'Costa Cruises',
      shipName: 'Costa Serena',
      packageName: '오키나와/타이완 5박 6일',
      nights: 5,
      days: 6,
      basePrice: 1450000,
      description: '부산 출발 오키나와, 타이베이, 지룽을 경유하는 5박 6일 크루즈',
      itineraryPattern: [
        {
          day: 1,
          type: 'Embarkation',
          location: 'Busan',
          country: 'KR',
          currency: 'KRW',
          language: 'ko',
          time: '15:00',
        },
        {
          day: 2,
          type: 'Cruising',
        },
        {
          day: 3,
          type: 'PortVisit',
          location: 'Okinawa',
          country: 'JP',
          currency: 'JPY',
          language: 'ja',
          arrival: '08:00',
          departure: '18:00',
        },
        {
          day: 4,
          type: 'PortVisit',
          location: 'Taipei',
          country: 'TW',
          currency: 'TWD',
          language: 'zh-TW',
          arrival: '09:00',
          departure: '20:00',
        },
        {
          day: 5,
          type: 'PortVisit',
          location: 'Keelung',
          country: 'TW',
          currency: 'TWD',
          language: 'zh-TW',
          arrival: '07:00',
          departure: '16:00',
        },
        {
          day: 6,
          type: 'Disembarkation',
          location: 'Busan',
          country: 'KR',
          currency: 'KRW',
          language: 'ko',
          time: '09:00',
        },
      ],
      updatedAt: new Date(),
    },
  });

  console.log('✅ Created CruiseProduct test data:');
  console.log('  1.', product1.productCode, '-', product1.packageName);
  console.log('  2.', product2.productCode, '-', product2.packageName);
  console.log('  3.', product3.productCode, '-', product3.packageName);
  console.log('\n📝 You can use these product codes for testing:');
  console.log('  - MSC-JP4N5D');
  console.log('  - RC-JP3N4D');
  console.log('  - COSTA-OKINAWA5N6D');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

