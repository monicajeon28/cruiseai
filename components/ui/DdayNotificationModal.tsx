'use client';

import { useEffect, useState } from 'react';

interface Trip { // Trip 타입 직접 정의
  cruiseName: string;
}

interface DdayNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  trip: Trip; // trip prop 추가
}

export default function DdayNotificationModal({
  isOpen,
  onClose,
  message,
  trip,
}: DdayNotificationModalProps) {
  // const [backgroundImage, setBackgroundImage] = useState<string>(''); // 배경 이미지 관련 상태 제거

  // 랜덤한 크루즈 배경 이미지 선택 로직 제거
  // useEffect(() => {
  //   if (trip && trip.cruiseName) {
  //     const cruiseFolderName = trip.cruiseName.replace(/ /g, ''); // 공백 제거
  //     const potentialImage = `/크루즈정보사진/${cruiseFolderName}/cover.png`; // cover.png가 있다고 가정
  //     // 실제 파일 존재 여부 확인 로직이 필요할 수 있으나, 일단 경로만 생성
  //     setBackgroundImage(potentialImage);
  //   } else {
  //     const defaultCruiseImages = [
  //       '/크루즈정보사진/MSC벨리시마/MSC 벨리시마 (1).png',
  //       '/크루즈정보사진/MSC벨리시마/MSC 벨리시마 (2).png',
  //       '/크루즈정보사진/MSC벨리시마/MSC 벨리시마 (3).png',
  //       '/크루즈정보사진/코스타세레나호/costa_serena_1.jpg',
  //       '/크루즈정보사진/코스타세레나호/costa_serena_2.jpg',
  //       '/크루즈정보사진/코스타세레나호/costa_serena_3.jpg',
  //       '/크루즈정보사진/홍콩/홍콩 관광지 스타거리 추천.png',
  //       '/크루즈정보사진/홍콩/홍콩 야경 관광지 추천.png',
  //     ];
  //     const randomImage = defaultCruiseImages[Math.floor(Math.random() * defaultCruiseImages.length)];
  //     setBackgroundImage(randomImage);
  //   }
  // }, [trip]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div 
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden p-8 border-4 border-brand-red animate-scale-in" // 깔끔하고 눈에 띄는 디자인으로 변경
        // style={{
        //   backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${backgroundImage})`,
        //   backgroundSize: 'cover',
        //   backgroundPosition: 'center',
        //   backgroundRepeat: 'no-repeat'
        // }}
      >
        {/* 배경 오버레이 제거 */}
        {/* <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 to-purple-900/80"></div> */}
        
        {/* 콘텐츠 */}
        <div className="relative z-10 text-gray-800"> {/* 텍스트 색상 변경 */}
          {/* 제목 */}
          <div className="text-center mb-6">
            <h2 className="text-4xl font-extrabold mb-2 text-brand-red drop-shadow-md"> {/* 텍스트 강조 및 색상 변경 */}
              🎉 D-Day 알림
            </h2>
            <p className="text-xl font-semibold text-gray-600"> {/* 텍스트 색상 변경 */}
              [ {trip.cruiseName} ] 여행을 잊지 마세요! ✨
            </p>
          </div>

          {/* 메시지 본문 */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200"> {/* 깔끔한 배경으로 변경 */}
            <div 
              className="text-lg leading-relaxed text-center text-gray-700"
              dangerouslySetInnerHTML={{ __html: message }}
            />
          </div>

          {/* 확인 버튼 */}
          <div className="text-center">
            <button
              onClick={onClose}
              className="bg-brand-red hover:bg-red-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              확인했습니다!
            </button>
          </div>
        </div>

        {/* 닫기 버튼 (우상단) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 bg-gray-200 text-gray-700 p-2 rounded-full text-xl hover:bg-gray-300 transition-colors"
          aria-label="닫기"
        >
          ×
        </button>
      </div>
    </div>
  );
}
