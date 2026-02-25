'use client';

export default function YoutubeLiveSection() {
  return (
    <section className="container mx-auto px-4 py-8 md:py-10">
      <div className="bg-gradient-to-br from-red-50 via-white to-yellow-50 rounded-3xl p-8 md:p-12 lg:p-16 shadow-2xl max-w-5xl mx-auto border-2 border-red-200 pb-8 md:pb-10 lg:pb-12">
        {/* 헤더 */}
        <div className="text-center mb-6 md:mb-8">
          <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4 leading-tight tracking-tight">
            <span className="block sm:inline text-red-600 mb-2 sm:mb-0">매주 화요일</span>
            <span className="block sm:inline sm:mx-2 text-red-600">라이브 방송</span>
            <br className="hidden sm:block" />
            <span className="block sm:inline mt-2 sm:mt-0">다양한 크루즈를</span>
            <span className="block sm:inline sm:mx-1">알려드립니다</span>
          </h3>
        </div>

        {/* 크루즈세미나 GIF 이미지 */}
        <div className="mb-6 md:mb-8 flex justify-center">
          <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/크루즈세미나.gif"
              alt="크루즈세미나"
              className="w-full h-auto object-cover"
            />
          </div>
        </div>


      </div>
    </section>
  );
}
