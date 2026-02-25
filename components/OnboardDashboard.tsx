import React from 'react';

interface OnboardDashboardProps {
  cruise: string;
  companion: string;
  destination: string;
}

const OnboardDashboard: React.FC<OnboardDashboardProps> = ({
  cruise,
  companion,
  destination,
}) => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">고객님을 위한 맞춤형 온보드 대시보드</h1>

      <div className="bg-blue-50 p-4 rounded-md shadow-sm mb-6">
        <h2 className="text-xl font-semibold text-blue-800 mb-2"> 여행 정보</h2>
        <p><strong>선택된 크루즈:</strong> {cruise}</p>
        <p><strong>동반자:</strong> {companion}</p>
        <p><strong>목적지:</strong> {destination}</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 border rounded-md bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-2">여행지/코스/맛집 추천 (예정)</h3>
          <p className="text-gray-600">선택하신 목적지({destination})에 맞춰 맞춤형 관광지, 코스, 맛집 정보를 제공할 예정입니다.</p>
          <button className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded text-sm">자세히 보기</button>
        </div>

        <div className="p-4 border rounded-md bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-2">환율 계산기 (예정)</h3>
          <p className="text-gray-600">선택하신 목적지({destination})의 현재 환율 정보를 기반으로 계산기를 제공할 예정입니다.</p>
          <button className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded text-sm">계산하기</button>
        </div>

        <div className="p-4 border rounded-md bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-2">심층 AI 대화 (예정)</h3>
          <p className="text-gray-600">고객님의 여행 정보에 기반한 심도 있는 AI 대화 기능을 제공할 예정입니다.</p>
          <button className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded text-sm">AI와 대화하기</button>
        </div>

        <div className="p-4 border rounded-md bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-2">정확한 통번역 서비스 (예정)</h3>
          <p className="text-gray-600">선택하신 목적지({destination})에 특화된 정확한 통번역 기능을 제공할 예정입니다.</p>
          <button className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded text-sm">번역 시작</button>
        </div>
      </div>
    </div>
  );
};

export default OnboardDashboard; 