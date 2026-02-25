'use client';

import Image from 'next/image';

interface FeatureGuideCardProps {
  icon: string;
  title: string;
  description: string;
  gifPath?: string;
  features: string[];
}

export default function FeatureGuideCard({
  icon,
  title,
  description,
  gifPath,
  features
}: FeatureGuideCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-start space-x-4">
        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-3xl text-white">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
          <p className="text-gray-600 mb-4">{description}</p>
          
          {/* 기능 목록 */}
          <ul className="space-y-2 mb-4">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center text-sm text-gray-700">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                {feature}
              </li>
            ))}
          </ul>
          
          {/* GIF 또는 이미지 표시 */}
          {gifPath && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <Image
                src={gifPath}
                alt={`${title} 사용법`}
                width={300}
                height={200}
                className="rounded-lg mx-auto"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-image.png';
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
