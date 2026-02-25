'use client';

import { useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import FeatureGuideCard from '@/components/FeatureGuideCard';

export default function GuidePage() {
  const router = useRouter();

  const features = [
    {
      icon: '💬',
      title: 'AI와 대화하기',
      description: '크루즈닷과 자유롭게 대화하며 크루즈 여행에 대한 모든 정보를 얻어보세요.',
      features: [
        '크루즈 선박 정보 및 시설 안내',
        '여행지 관광지 추천',
        '길찾기 및 교통편 안내',
        '실시간 질문 답변'
      ]
    },
    {
      icon: '📸',
      title: '사진으로 질문하기',
      description: '사진을 업로드하면 크루즈닷이 이미지를 분석하고 관련 정보를 제공합니다.',
      features: [
        '크루즈 선박 사진 분석',
        '관광지 사진 인식',
        '메뉴판 및 간판 번역',
        '사진 기반 추천 서비스'
      ]
    },
    {
      icon: '🎤',
      title: '음성 통역기',
      description: '실시간 음성 인식과 번역으로 현지인과의 소통을 도와드립니다.',
      features: [
        '한국어 → 현지어 실시간 번역',
        '현지어 → 한국어 실시간 번역',
        '음성 합성으로 발음 안내',
        '여행지 언어 자동 설정'
      ]
    },
    {
      icon: '📋',
      title: '여행 준비물 체크리스트',
      description: '크루즈 여행에 필요한 모든 준비물을 체계적으로 관리하세요.',
      features: [
        '기본 준비물 자동 제공',
        '개인 맞춤 항목 추가',
        '체크 상태 실시간 저장',
        '완료 시 축하 메시지'
      ]
    },
    {
      icon: '💰',
      title: '여행 가계부',
      description: '여행 중 지출을 현지 통화, 원화, 달러로 동시 관리하세요.',
      features: [
        '실시간 환율 정보 제공',
        '3개 통화 동시 표시',
        '지출 내역 자동 저장',
        '카테고리별 분류'
      ]
    },
    {
      icon: '🗺️',
      title: '스마트 내비게이션',
      description: '구글맵 연동으로 정확한 길찾기 정보를 제공합니다.',
      features: [
        '현재 위치 기반 길찾기',
        '크루즈 터미널 자동 인식',
        '대중교통 정보 제공',
        '실시간 교통 상황 반영'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900"> {/* 전체 배경 흰색, 글씨 검정색 */}
      {/* 헤더 */}
      <div className="bg-white border-b border-blue-200"> {/* 헤더 배경 및 테두리 */}
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center text-gray-700 hover:text-gray-900 transition-colors"
            >
              <FiArrowLeft size={24} className="mr-2" />
              <span>뒤로가기</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              크루즈닷 사용 설명서 💡
            </h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="container mx-auto px-6 py-8">
        {/* 소개 섹션 */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl text-white"> {/* 배경색 파란색, 글씨 흰색 */}
            🧞‍♂️
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            크루즈닷AI와 함께하는 스마트 여행
          </h2>
          <p className="text-gray-700 text-lg max-w-2xl mx-auto">
            AI 기술로 더욱 편리하고 즐거운 크루즈 여행을 경험해보세요. 
            크루즈닷이 여행의 모든 순간을 도와드립니다.
          </p>
        </div>

        {/* 기능 가이드 카드들 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <FeatureGuideCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              features={feature.features}
            />
          ))}
        </div>

        {/* 추가 팁 섹션 */}
        <div className="mt-16 bg-blue-50 rounded-2xl p-8 border border-blue-200"> {/* 배경색 및 테두리 변경 */}
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            💡 사용 팁
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-100 rounded-xl p-6"> {/* 항목 배경색 변경 */}
              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                🎯 효과적인 질문 방법
              </h4>
              <ul className="space-y-2 text-gray-700">
                <li>• 구체적이고 명확한 질문을 해보세요</li>
                <li>• &quot;어디에&quot;, &quot;언제&quot;, &quot;어떻게&quot; 등의 질문어를 활용하세요</li>
                <li>• 사진과 함께 질문하면 더 정확한 답변을 받을 수 있어요</li>
              </ul>
            </div>
            <div className="bg-blue-100 rounded-xl p-6"> {/* 항목 배경색 변경 */}
              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                🌟 최적의 사용 환경
              </h4>
              <ul className="space-y-2 text-gray-700">
                <li>• 안정적인 인터넷 연결이 필요해요</li>
                <li>• 음성 기능 사용 시 조용한 환경을 권장해요</li>
                <li>• 사진 촬영 시 충분한 조명을 확보하세요</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 문의 섹션 */}
        <div className="mt-12 text-center">
          <div className="bg-blue-50 rounded-2xl p-8 border border-blue-200"> {/* 배경색 및 테두리 변경 */}
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              더 궁금한 것이 있으신가요?
            </h3>
            <p className="text-gray-700 mb-6">
              크루즈닷에게 직접 질문해보세요! 언제든지 도움을 드릴 준비가 되어있어요.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              크루즈닷과 대화하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
