export const DEFAULT_B2B_LANDING_TEMPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- NEW: Title changed to emphasize exclusivity and professionalism -->
    <title>[단 50명 모집] 여행이 '일'이 되는 프로페셔널 | 크루즈 스탭 전문 과정</title>
    <script src="https://player.vimeo.com/api/player.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Kakao SDK removed -->
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --brand-yellow: #FEE500; /* Kakao Yellow */
            --brand-cyan: #22D3EE;
            --dark-bg: #111827;
            --dark-card: #1F2937;
            --dark-border: #374151;
        }
        html { scroll-behavior: smooth; }
        body {
            font-family: 'Noto Sans KR', sans-serif;
            background-color: var(--dark-bg);
            color: #F9FAFB;
            /* Removed padding-top as banner is gone */
            word-break: keep-all;
            line-height: 1.75;
        }
        img, iframe {
            display: block;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            margin: 1rem auto;
        }
        .content-wrapper {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 0 1rem;
        }
        .section-title {
            font-size: 2.25rem;
            font-weight: 900;
            text-align: center;
            margin-bottom: 1.5rem;
            line-height: 1.3;
        }
        @media (min-width: 768px) {
            .section-title {
                font-size: 2.5rem;
            }
        }
        .section-title span { color: var(--brand-yellow); }
        
        .stats-container{ background: var(--dark-card); border-radius:15px; border: 1px solid var(--dark-border); }
        
        /* Kakao Share Banner Removed */
        
        /* Animations */
        .highlight{animation:pulse .5s ease-out;}
        @keyframes pulse{0%{transform:scale(1);}50%{transform:scale(1.05);}100%{transform:scale(1);}}
        
        .cta-button { 
            transition: all 0.3s ease; 
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .blinking { animation: blinker 1.5s linear infinite; }
        @keyframes blinker { 50% { opacity: 0; } }

        .final-cta-button {
            animation: final-pulse 2s infinite;
        }
        @keyframes final-pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.4); }
            70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(34, 211, 238, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
        }

        /* Video Container */
        .video-container {
            position: relative; padding-bottom: 56.25%;
            height: 0; overflow: hidden; max-width: 100%;
            background: #000; border-radius: 0.75rem;
        }
        .video-container iframe {
            position: absolute; top: 0; left: 0;
            width: 100%; height: 100%;
        }

        /* Social Proof Popup */
        #social-proof-popup {
            transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out;
        }

        /* Grid Item Styling */
        .grid-item {
            position: relative;
            cursor: pointer;
            overflow: hidden;
            border-radius: 0.75rem;
            transition: transform 0.3s ease;
        }
        .grid-item:hover {
            transform: scale(1.05);
        }
        .grid-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            margin: 0;
            border-radius: 0;
        }
        
        /* Modal (Shared by Video and Image) */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); z-index: 2000;
            display: flex; justify-content: center; align-items: center;
            opacity: 0; visibility: hidden; transition: all .3s ease;
        }
        .modal-overlay.active { opacity: 1; visibility: visible; }
        .modal-video-content {
            position: relative; width: 90%; max-width: 800px;
            padding-bottom: 50.625%; /* 16:9 aspect ratio */
        }
        .modal-image-content {
            position: relative;
            width: auto;
            height: auto;
            max-width: 90vw;
            max-height: 90vh;
        }
        .modal-close {
            position: absolute; top: -40px; right: 0;
            color: white; font-size: 2.5rem; cursor: pointer;
            font-weight: bold;
            line-height: 1;
        }

        /* Sticky CTA Banner */
        #sticky-cta-banner {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            background: linear-gradient(to right, #1e3a8a, var(--brand-cyan));
            color: white;
            padding: 12px 20px;
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 -4px 15px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.3s ease;
        }
        #sticky-cta-banner:hover {
            transform: translateY(-3px);
        }
        @media (min-width: 768px) {
            #sticky-cta-banner {
                padding: 16px 20px;
            }
        }

        /* Exit Intent Modal */
        #exit-intent-modal {
            z-index: 3000;
        }
        #exit-intent-modal .modal-content {
            background-color: var(--dark-card);
            border: 1px solid var(--dark-border);
            border-radius: 1rem;
            padding: 2rem;
            width: 90%;
            max-width: 500px;
            text-align: center;
            position: relative;
        }
        #exit-intent-modal .modal-close {
            top: -10px;
            right: 10px;
            font-size: 2rem;
        }
        .agree-label {
            display: flex;
            align-items: center;
            cursor: pointer;
            font-size: 0.875rem;
            color: #d1d5db;
        }
        .agree-label input {
            margin-right: 0.5rem;
        }
    </style>
</head>
<body>
    <!-- Kakao Share Banner REMOVED -->

    <!-- Main Content Area -->
    <div class="bg-black text-white">
        
        <!-- 1. 시선 집중 (Hook) - NEW: Re-framed for "Career" not "Travel" -->
        <section class="text-center pt-12">
            <div class="content-wrapper">
                <h1 class="text-4xl md:text-6xl font-black leading-tight my-8">
                    <span class="text-yellow-400">"대한민국 최초 크루즈여행 시스템"</span>
                    <span class="block text-2xl md:text-4xl font-black mt-4 text-white leading-snug">
                        이거 모르면 땅치고 후회합니다.
                    </span>
                    <span class="block text-3xl md:text-5xl font-black mt-8 text-white leading-snug">
                        지금부터<br>
                        <span class="text-cyan-400">여행 자동화 시스템</span>을<br>
                        3일 무료 경험 해 보세요
                    </span>
                </h1>

                <!-- 시스템 미리보기 이미지 그리드 (2열) -->
                <div class="grid grid-cols-2 gap-3 md:gap-4 my-8 md:my-12">
                    <div class="aspect-square rounded-xl overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all hover:scale-105 cursor-pointer" onclick="showImage(this.querySelector('img').src)">
                        <img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_8859.jpg" alt="3일 체험 1" class="w-full h-full object-cover" loading="lazy">
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all hover:scale-105 cursor-pointer" onclick="showImage(this.querySelector('img').src)">
                        <img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_9565.jpg" alt="3일 체험 2" class="w-full h-full object-cover" loading="lazy">
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all hover:scale-105 cursor-pointer" onclick="showImage(this.querySelector('img').src)">
                        <img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_043.jpg" alt="3일 체험 3" class="w-full h-full object-cover" loading="lazy">
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all hover:scale-105 cursor-pointer" onclick="showImage(this.querySelector('img').src)">
                        <img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_1041.jpg" alt="3일 체험 4" class="w-full h-full object-cover" loading="lazy">
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all hover:scale-105 cursor-pointer" onclick="showImage(this.querySelector('img').src)">
                        <img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7118.png" alt="판매원 대시보드" class="w-full h-full object-cover" loading="lazy">
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all hover:scale-105 cursor-pointer" onclick="showImage(this.querySelector('img').src)">
                        <img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7551.png" alt="세일즈 챗봇" class="w-full h-full object-cover" loading="lazy">
                    </div>
                    <div class="aspect-square rounded-xl overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all hover:scale-105 cursor-pointer col-span-2" onclick="showImage(this.querySelector('img').src)">
                        <img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_9114.png" alt="개인 구매몰" class="w-full h-full object-cover" loading="lazy">
                    </div>
                </div>

                <h2 class="text-3xl md:text-5xl font-black text-white mt-16 mb-8 leading-tight">
                    "3일동안 <span class="text-cyan-400">여행사 시스템</span>을<br>
                    경험해 보세요"
                </h2>

                <!-- FORM_TOP -->

                <div class="py-10 md:py-16">
                    <h2 class="text-3xl md:text-5xl font-black text-white">단순 여행이 아닙니다.</h2>
                    <p class="text-xl md:text-2xl font-bold text-cyan-400 mt-3">'여행하며 수익을 창출하는' 전문 커리어입니다.</p>
                </div>

                <!-- NEW: Video changed to "What it's like to be staff" -->
                <div class="video-container mt-0 shadow-2xl">
                    <iframe src="https://www.youtube-nocookie.com/embed/KNf8TZ75YZQ?autoplay=1&amp;mute=1&amp;loop=1&amp;playlist=KNf8TZ75YZQ&amp;modestbranding=1&amp;iv_load_policy=3&amp;controls=0" title="크루즈 스탭의 실제 활동 모습" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="" loading="lazy"></iframe>
                </div>

                <div class="py-8"></div> 

                <!-- NEW: Before vs After -->
                <h2 class="text-3xl md:text-4xl font-black text-white mt-12">월급 227만원 연구원, 평범한 주부에서...</h2>
                <p class="text-xl md:text-2xl font-bold text-cyan-400 mt-3">여행을 '일'로 만드는 프로 인솔자가 되기까지</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center my-8">
                    <div class="text-center">
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-06-26/b941a75d82cb776b1c7905af131243fa_1750946396_3068.png" alt="과거 연구원 시절" loading="lazy" class="w-full">
                        <p class="font-bold text-lg mt-2">BEFORE</p>
                        <p class="text-gray-400">반복되는 일상, 정해진 월급</p>
                    </div>
                    <div class="text-center">
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-06-26/b941a75d82cb776b1c7905af131243fa_1750946396_2474.png" alt="크루즈 스탭 활동" loading="lazy" class="w-full">
                        <p class="font-bold text-lg mt-2 text-yellow-400">AFTER</p>
                        <p class="text-gray-200">여행하며 수익을 창출하는 전문가</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- NEW SECTION: The Unbeatable Tech Advantage -->
        <section class="py-20 bg-gray-900">
            <div class="content-wrapper">
                <h2 class="section-title"><span class="text-cyan-400">경쟁사는 흉내조차 낼 수 없습니다.</span><br>왜 '마비즈'여야 하는가?</h2>
                <p class="text-lg text-center text-gray-300 mb-12">우리는 당신이 '진짜 전문가'가 될 수 있도록<br>업계 유일의 독점적인 기술을 지원합니다.</p>
                
                <h3 class="text-2xl font-bold text-white text-center mb-4">1. 고객이 엄지척 하는 <span class="text-yellow-400">AI 세일즈 챗봇</span> '크루즈닷AI'</h3>
                <div class="video-container shadow-2xl mb-12">
                    <iframe src="https://www.youtube-nocookie.com/embed/-p_6G69MgyQ?autoplay=1&amp;mute=1&amp;loop=1&amp;playlist=-p_6G69MgyQ&amp;modestbranding=1&amp;iv_load_policy=3&amp;controls=0" title="크루즈 AI 가이드 시스템" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="" loading="lazy"></iframe>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 class="text-2xl font-bold text-white text-center mb-4">2. <span class="text-yellow-400">대기업·중견기업</span> 협력</h3>
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763276384_7279.jpg" alt="대기업 중견기업 협력" loading="lazy">
                        <p class="text-center text-gray-300 mt-4">신뢰할 수 있는 국내 유수 기업들과의 제휴로 스탭 활동의 격을 높입니다.</p>
                    </div>
                    <div>
                        <h3 class="text-2xl font-bold text-white text-center mb-4">3. <span class="text-yellow-400">AI 세일즈 챗봇</span> 지원</h3>
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763271257_8093.png" alt="크루즈닷AI 세일즈 챗봇" loading="lazy">
                        <p class="text-center text-gray-300 mt-4">24시간 고객을 응대하는 AI 챗봇이 당신의 영업사원이 되어 수익을 극대화합니다.</p>
                    </div>
                    <!-- NEW ITEM 1 -->
                    <div>
                        <h3 class="text-2xl font-bold text-white text-center mb-4">4. <span class="text-yellow-400">라이브 방송</span> 지원</h3>
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275311_9215.png" alt="크루즈 라이브 방송 카톡방 지원" loading="lazy">
                        <p class="text-center text-gray-300 mt-4">고객과 실시간 소통하는 라이브 방송 및 카톡방 운영을 지원합니다.</p>
                    </div>
                    <!-- NEW ITEM 2 -->
                    <div>
                        <h3 class="text-2xl font-bold text-white text-center mb-4">5. <span class="text-yellow-400">라이브 쇼핑</span> 지원</h3>
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275430_2282.gif" alt="크루즈 라이브 쇼핑 방송 지원" loading="lazy">
                        <p class="text-center text-gray-300 mt-4">높은 전환율을 만드는 라이브 쇼핑 방송 시스템을 지원합니다.</p>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- NEW: The 8 Pillars Section -->
        <section class="py-20 bg-gray-900">
            <div class="content-wrapper">
                <h2 class="section-title">당신은 '교육'과 '고객'에만 집중하세요.<br><span class="text-cyan-400">나머지는 본사가 모두 지원합니다.</span></h2>
                <p class="text-lg text-center text-gray-300 mb-12">단순히 강의만 파는 곳과 비교를 거부합니다.<br>이것이 마비즈 수강생 95.7%가 수익을 내는 이유입니다.</p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Feature 1: AI Chatbot -->
                    <div class="bg-dark-card p-6 rounded-lg border border-dark-border flex items-center">
                        <span class="text-3xl mr-4">🤖</span>
                        <div>
                            <h3 class="text-lg font-bold text-white">판매원 챗봇 AI (크루즈닷AI) 지원</h3>
                            <p class="text-sm text-gray-400">24시간 나를 대신해 고객을 응대하는 AI 비서</p>
                        </div>
                    </div>
                    <!-- Feature 2: Sales Mall -->
                    <div class="bg-dark-card p-6 rounded-lg border border-dark-border flex items-center">
                        <span class="text-3xl mr-4">🛍️</span>
                        <div>
                            <h3 class="text-lg font-bold text-white">개인 판매원 몰 시스템 지원</h3>
                            <p class="text-sm text-gray-400">즉시 판매가 가능한 나만의 크루즈 쇼핑몰</p>
                        </div>
                    </div>
                    <!-- Feature 3: Online Education -->
                    <div class="bg-dark-card p-6 rounded-lg border border-dark-border flex items-center">
                        <span class="text-3xl mr-4">💻</span>
                        <div>
                            <h3 class="text-lg font-bold text-white">100% 온라인 원격 교육</h3>
                            <p class="text-sm text-gray-400">언제 어디서든 학습 가능한 평생교육원 시스템</p>
                        </div>
                    </div>
                    <!-- Feature 4: Mentoring -->
                    <div class="bg-dark-card p-6 rounded-lg border border-dark-border flex items-center">
                        <span class="text-3xl mr-4">🤝</span>
                        <div>
                            <h3 class="text-lg font-bold text-white">1:1 멘토링 지원</h3>
                            <p class="text-sm text-gray-400">성공한 선배가 직접 이끄는 전담 멘토 시스템</p>
                        </div>
                    </div>
                    <!-- Feature 5: Partnerships -->
                    <div class="bg-dark-card p-6 rounded-lg border border-dark-border flex items-center">
                        <span class="text-3xl mr-4">🏢</span>
                        <div>
                            <h3 class="text-lg font-bold text-white">대기업·중견기업 연합</h3>
                            <p class="text-sm text-gray-400">신뢰할 수 있는 파트너사들과의 강력한 협력</p>
                        </div>
                    </div>
                    <!-- Feature 6: Real Training -->
                    <div class="bg-dark-card p-6 rounded-lg border border-dark-border flex items-center">
                        <span class="text-3xl mr-4">🛳️</span>
                        <div>
                            <h3 class="text-lg font-bold text-white">100% 실무 교육 지원</h3>
                            <p class="text-sm text-gray-400">크루즈 탑승, 기항지 투어, 고객 인솔 실무</p>
                        </div>
                    </div>
                    <!-- Feature 7: Marketing -->
                    <div class="bg-dark-card p-6 rounded-lg border border-dark-border flex items-center">
                        <span class="text-3xl mr-4">📈</span>
                        <div>
                            <h3 class="text-lg font-bold text-white">상위 1% 마케팅 교육</h3>
                            <p class="text-sm text-gray-400">고객을 끌어당기는 검증된 마케팅 비법</p>
                        </div>
                    </div>
                    <!-- Feature 8: Sales -->
                    <div class="bg-dark-card p-6 rounded-lg border border-dark-border flex items-center">
                        <span class="text-3xl mr-4">💰</span>
                        <div>
                            <h3 class="text-lg font-bold text-white">상위 1% 세일즈 전문 교육</h3>
                            <p class="text-sm text-gray-400">팔지 않아도 팔리는 압도적인 세일즈 전략</p>
                        </div>
                    </div>
                </div>

                <!-- MINI_CLASS -->

                <!-- 미니 클래스 밑 CTA -->
                <div class="mt-12 text-center">
                    <h3 class="text-2xl md:text-3xl font-black text-yellow-400 mb-4">
                        지금 당장 3일 시스템 체험하기
                    </h3>
                    <p class="text-gray-300 mb-6">이름과 연락처만 입력하면 바로 시작됩니다</p>
                </div>
                <!-- FORM_MIDDLE -->
            </div>
        </section>

        <!-- 3. 핵심 증거 제시 (Proof - Videos) - REMOVED, already used new videos -->
        <!-- Old video section is removed as we integrated the new videos elsewhere -->

        <!-- NEW: Marquee Image Section (Moved here) -->
        <div class="py-8 bg-black overflow-hidden w-full">
            <style>
                .marquee-container { display: flex; overflow: hidden; width: 100%; margin-bottom: 1rem; }
                .marquee-content { display: flex; flex-shrink: 0; align-items: center; animation: scroll-left 30s linear infinite; }
                .marquee-content.reverse { animation: scroll-right 30s linear infinite; }
                .marquee-item { flex: 0 0 auto; width: 150px; height: 150px; margin-right: 1rem; border-radius: 0.75rem; overflow: hidden; border: 1px solid #374151; }
                .marquee-item img { width: 100%; height: 100%; object-fit: cover; margin: 0; }
                @keyframes scroll-left { from { transform: translateX(0); } to { transform: translateX(-50%); } }
                @keyframes scroll-right { from { transform: translateX(-50%); } to { transform: translateX(0); } }
                @media (min-width: 768px) { .marquee-item { width: 200px; height: 200px; margin-right: 1.5rem; } }
            </style>
            <div class="marquee-container">
                <div class="marquee-content">
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_8859.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_9565.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_043.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_1041.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7118.png" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7551.png" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_9114.png" alt="img"></div>
                    <!-- Duplicate -->
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_8859.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_9565.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_043.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_1041.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7118.png" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7551.png" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_9114.png" alt="img"></div>
                </div>
            </div>
            <div class="marquee-container">
                <div class="marquee-content reverse">
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_8859.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_9565.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_043.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_1041.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7118.png" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7551.png" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_9114.png" alt="img"></div>
                    <!-- Duplicate -->
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_8859.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492349_9565.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_043.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-11-30/e9ac5e0515cbeac8729782ba6c2d93d6_1764492350_1041.jpg" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7118.png" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_7551.png" alt="img"></div>
                    <div class="marquee-item"><img src="https://leadgen.kr/data/file/smarteditor2/2025-12-01/1d909001e8c10d0e5dca46adce6195e4_1764566879_9114.png" alt="img"></div>
                </div>
            </div>
        </div>

        <!-- 4. 성장 곡선 강조 (Growth Roadmap) - Kept, still relevant -->
        <section class="py-20 bg-gray-800">
            <div class="content-wrapper">
                <h2 class="section-title"><span class="text-cyan-400">체계적인 성장 과정</span>입니다.</h2>
                <div class="bg-dark-card p-8 rounded-2xl border border-dark-border">
                    <div class="relative">
                        <!-- Dashed Line -->
                        <div class="absolute top-1/2 left-0 w-full h-0.5 bg-gray-600 border-t-2 border-dashed border-gray-500" style="transform: translateY(-50%);"></div>
                        <!-- Steps -->
                        <div class="relative flex justify-between items-start text-center">
                            <div class="w-1/4">
                                <div class="bg-cyan-500 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-lg border-4 border-dark-card">1단계</div>
                                <p class="font-bold text-white mt-3">1주</p>
                                <p class="text-sm text-gray-400 leading-tight mt-1">크루즈 전문 교육과정</p>
                            </div>
                            <div class="w-1/4">
                                <div class="bg-cyan-600 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-lg border-4 border-dark-card">2단계</div>
                                <p class="font-bold text-white mt-3">2주</p>
                                <p class="text-sm text-gray-400 leading-tight mt-1">크루즈 전문 인솔과정</p>
                            </div>
                            <div class="w-1/4">
                                <div class="bg-cyan-700 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-lg border-4 border-dark-card">3단계</div>
                                <p class="font-bold text-white mt-3">3주</p>
                                <p class="text-sm text-gray-400 leading-tight mt-1">퍼포먼스 마케팅 과정</p>
                            </div>
                            <div class="w-1/4">
                                <div class="bg-cyan-800 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-lg border-4 border-dark-card">4단계</div>
                                <p class="font-bold text-white mt-3">4주</p>
                                <p class="text-sm text-gray-400 leading-tight mt-1">95.7% 여행사 프리랜서 계약</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 5. Wall of Love (Reviews) - NEW: Updated with new images -->
        <section class="py-20 bg-gray-900">
            <div class="content-wrapper">
                <h3 class="text-2xl md:text-3xl font-bold text-center mb-8 text-white">꾸며낸 후기가 아닌, <span class="text-cyan-400">진짜 수강생들의 목소리</span>입니다.</h3>
                <p class="text-center text-gray-400 mb-8">(수강생들의 동의 하에 공개합니다.)</p>
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-06-26/b941a75d82cb776b1c7905af131243fa_1750943544_0562.png')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-06-26/b941a75d82cb776b1c7905af131243fa_1750943544_0562.png" alt="수강생 후기 카톡 1" loading="lazy"></div>
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754193750_2256.png')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754193750_2256.png" alt="고객 문자 후기" loading="lazy"></div>
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-06-26/b941a75d82cb776b1c7905af131243fa_1750943544_5234.png')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-06-26/b941a75d82cb776b1c7905af131243fa_1750943544_5234.png" alt="수강생 후기 카톡 2" loading="lazy"></div>
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-06-26/b941a75d82cb776b1c7905af131243fa_1750943495_2443.png')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-06-26/b941a75d82cb776b1c7905af131243fa_1750943495_2443.png" alt="특강 후기" loading="lazy"></div>
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754194677_3697.png')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754194677_3697.png" alt="수강생 크루즈 결제 후기" loading="lazy"></div>
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754194677_4423.png')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754194677_4423.png" alt="수강생 결제 후기" loading="lazy"></div>
                </div>
            </div>
        </section>

        <!-- 6. NEW: Real Staff Activity Photos -->
        <section class="py-20 bg-black">
            <div class="content-wrapper">
                <h3 class="text-2xl md:text-3xl font-bold text-center mb-12 text-white">이론이 아닙니다. <span class="text-cyan-400">100% 실무 현장</span>입니다.</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275229_9164.jpg')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275229_9164.jpg" alt="크루즈 터미널 인솔" loading="lazy"></div>
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275230_1588.jpg')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275230_1588.jpg" alt="기항지 투어 인솔" loading="lazy"></div>
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275230_6515.jpg')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275230_6515.jpg" alt="크루즈 쉽투어" loading="lazy"></div>
                    <div class="grid-item aspect-[9/16]" onclick="showImage('https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275231_6474.jpg')"><img src="https://leadgeny.kr/data/file/smarteditor2/2025-11-16/354def09d2ee2d48ff812a59a1f2c00b_1763275231_6474.jpg" alt="크루즈 스탭 고객 안내" loading="lazy"></div>
                </div>
                <!-- Mid-page CTA -->
                <div class="text-center mt-12 content-wrapper">
                    <div class="cta-button inline-block bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-lg sm:text-xl md:text-2xl py-3 px-6 sm:py-4 sm:px-8 md:py-5 md:px-12 rounded-full shadow-lg cursor-pointer" onclick="document.getElementById('apply').scrollIntoView({ behavior: 'smooth' });">
                        1:1 무료 컨설팅 신청하기
                        <span class="block text-xs sm:text-sm font-normal mt-1">(선착순 50명 / 오늘 자정 마감)</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- 7. NEW: Meet the Mentors Section -->
        <section class="py-20 bg-gray-800">
            <div class="content-wrapper">
                <h2 class="section-title">당신을 성공으로 이끌 <span class="text-yellow-400">1:1 전담 멘토</span></h2>
                <p class="text-lg text-center text-gray-300 mb-12">이미 성공의 길을 걷고 있는 전문가 멘토 군단이<br>당신의 첫 수익이 날 때까지 멱살 잡고 끌고 갑니다.</p>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div class="text-center">
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754199867_3063.png" alt="모니카 대표" class="w-40 h-40 object-cover rounded-full mx-auto border-4 border-cyan-500" loading="lazy">
                        <h3 class="font-bold text-white text-xl mt-4">모니카 대표</h3>
                        <p class="text-sm text-cyan-400">총괄 디렉터</p>
                    </div>
                    <div class="text-center">
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754199901_6284.jpg" alt="로즈 코치" class="w-40 h-40 object-cover rounded-full mx-auto border-4 border-gray-600" loading="lazy">
                        <h3 class="font-bold text-white text-xl mt-4">로즈 코치</h3>
                        <p class="text-sm text-gray-400">전문 멘토</p>
                    </div>
                    <div class="text-center">
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754199918_2226.jpg" alt="페르 코치" class="w-40 h-40 object-cover rounded-full mx-auto border-4 border-gray-600" loading="lazy">
                        <h3 class="font-bold text-white text-xl mt-4">페르 코치</h3>
                        <p class="text-sm text-gray-400">전문 멘토</p>
                    </div>
                    <div class="text-center">
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754199981_5468.jpg" alt="해리 점장" class="w-40 h-40 object-cover rounded-full mx-auto border-4 border-gray-600" loading="lazy">
                        <h3 class="font-bold text-white text-xl mt-4">해리 점장</h3>
                        <p class="text-sm text-gray-400">전문 멘토</p>
                    </div>
                    <div class="text-center">
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754199959_7439.jpg" alt="맥스 코치" class="w-40 h-40 object-cover rounded-full mx-auto border-4 border-gray-600" loading="lazy">
                        <h3 class="font-bold text-white text-xl mt-4">맥스 코치</h3>
                        <p class="text-sm text-gray-400">전문 멘토</p>
                    </div>
                    <div class="text-center">
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-03/2aaf4aa2aa0950f4d179e35f99934319_1754199959_7938.jpg" alt="저스틴 코치" class="w-40 h-40 object-cover rounded-full mx-auto border-4 border-gray-600" loading="lazy">
                        <h3 class="font-bold text-white text-xl mt-4">저스틴 코치</h3>
                        <p class="text-sm text-gray-400">전문 멘토</p>
                    </div>
                </div>
            </div>
        </section>
        <!-- 8. Coach Section / Final Proof - Kept -->
        <section class="py-20 bg-black">
            <div class="container mx-auto px-4 text-center">
                <h2 class="text-3xl md:text-5xl font-black mb-4 text-white">
                    우리는 그럴듯한 말로 포장하지 않습니다.<br>
                    <span class="text-cyan-400">수강생들의 실제 수익 데이터로 증명합니다.</span>
                </h2>
                <div class="text-lg text-gray-200 my-12 max-w-3xl mx-auto leading-relaxed">
                    <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-27/35678ffef7bca30be7b0a09219c12215_1756225523_6478.gif" title="수강생 수익 인증" width="100%" loading="lazy">
                </div>
            </div>
        </section>

        <!-- 9. NEW: Final Testimonials Before CTA -->
        <section class="py-20 bg-gray-800">
            <div class="content-wrapper">
                <h2 class="section-title">아직도 망설여지시나요?<br><span class="text-cyan-400">인생이 바뀐 선배들의</span> 진짜 목소리</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                    <div class="rounded-xl overflow-hidden">
                        <h3 class="font-bold text-xl mb-4 text-center text-white">"직장이 없어졌고 취업도 힘들었는데<br>크루즈로 프리하게 일합니다."</h3>
                        <div class="video-container">
                            <iframe src="https://www.youtube.com/embed/3Ug-HG4i7FQ?si=esKbmWM4lG9PHtOn&amp;modestbranding=1&amp;iv_load_policy=3&amp;controls=1&amp;rel=0" title="직장이 없어져도 크루즈로 프리하게 일합니다" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>
                        </div>
                    </div>
                    <div class="rounded-xl overflow-hidden">
                        <h3 class="font-bold text-xl mb-4 text-center text-white">"딱 1년 집중했더니<br>인생이 바뀌었어요"</h3>
                        <div class="video-container">
                            <iframe src="https://www.youtube.com/embed/o_xO-_T3wkU?si=vuIz19HYyIwB3jzU&amp;modestbranding=1&amp;iv_load_policy=3&amp;controls=1&amp;rel=0" title="1년 집중했더니 인생이 바뀌었어요" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 10. Final CTA Section - NEW: Reframed for Consultation -->
        <section id="apply" class="py-20 bg-gray-900">
            <div class="container mx-auto px-4 text-center">
                
                <h2 class="text-3xl md:text-5xl font-black text-white mb-4">블루오션 크루즈 여행사 창업</h2>
                <p class="text-lg text-gray-200 mb-8 leading-relaxed">인생을 바꿀 대한민국 최초 시스템</p>
                
                <div class="bg-gray-800 max-w-2xl mx-auto p-8 md:p-10 rounded-3xl shadow-2xl border border-cyan-500/50 relative overflow-hidden group">
                    <!-- Background Glow Effect -->
                    <div class="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-500/10 to-blue-600/10 opacity-50 pointer-events-none"></div>
                    
                    <div class="text-center mb-8 relative z-10">
                        <h3 class="text-3xl md:text-5xl font-black text-white mb-6 leading-tight animate-pulse">
                            3일 시스템 경험하기<br>
                            <span class="text-yellow-400 text-5xl md:text-7xl block my-4 drop-shadow-lg">"무료"</span>
                            지금 시작 해 보기
                        </h3>
                        <p class="text-gray-300 text-base md:text-lg font-medium bg-gray-900/50 inline-block px-4 py-2 rounded-full border border-gray-700">
                            👇 이름과 연락처를 입력하면 시스템을 구경할 수 있습니다.
                        </p>
                    </div>
                    
                    <!-- FORM_MIDDLE -->
                    
                    <!-- Trust Badges -->
                    <div class="mt-8 pt-6 border-t border-gray-700 relative z-10">
                        <h4 class="text-sm text-gray-400 mb-3 font-bold">신뢰할 수 있는 정식 교육기관</h4>
                        <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-27/35678ffef7bca30be7b0a09219c12215_1756222745_5229.jpg" alt="원격평생교육원시설신고증" class="max-w-xs mx-auto rounded-lg shadow-md" loading="lazy">
                    </div>

                    <div class="flex flex-col sm:flex-row justify-center items-center text-xs text-gray-500 mt-6 space-y-2 sm:space-y-0 sm:space-x-4 relative z-10">
                        <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                            개인정보보호정책에 따라 안전하게 보호됩니다.
                        </span>
                        <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            교육청 정식 신고 기관: 제2025-1호
                        </span>
                    </div>
                </div>
                <div class="mt-8">
                    <p class="text-xl font-bold text-red-500 blinking">50명 모집 마감까지 <span id="countdown">00:00:00</span></p>
                </div>
            </div>
        </section>

        <!-- Footer -->
        <footer class="bg-gray-900 py-8">
            <div class="container mx-auto px-4 text-center text-gray-500 text-sm">
                <p>(주)마비즈컴퍼니 | 대표: 전혜선</p>
                <p>사업자등록번호: 4-57-00419 | 교육청신고: 제2025-1호</p>
                <p>주소: 서울특별시 마포구 월드컵로 196</p>
                <p class="mt-4">© 2025 MABIZ COMPANY. All Rights Reserved.</p>
            </div>
        </footer>
    </div>

    <!-- Video Modal -->
    <div id="video-modal" class="modal-overlay" onclick="closeModal()">
        <div class="modal-video-content" onclick="event.stopPropagation()">
            <span class="modal-close" onclick="closeModal()">×</span>
            <div id="video-player-container"></div>
        </div>
    </div>
    
    <!-- Image Modal -->
    <div id="image-modal" class="modal-overlay" onclick="closeImageModal()">
        <div class="modal-image-content" onclick="event.stopPropagation()">
            <span class="modal-close" onclick="closeImageModal()">×</span>
            <img id="modal-image" src="" alt="확대 이미지" class="max-w-full max-h-[90vh] rounded-lg" loading="lazy">
        </div>
    </div>

    <!-- Social Proof Popup -->
    <div id="social-proof-popup" class="fixed bottom-5 left-5 bg-white text-gray-800 text-sm font-bold px-4 py-2 rounded-lg shadow-2xl opacity-0 transform translate-y-5 z-50"></div>
    
    <!-- Sticky CTA Banner - NEW: Updated for new CTA -->
    <div id="sticky-cta-banner" onclick="document.getElementById('apply').scrollIntoView({ behavior: 'smooth' });">
        <span class="font-bold text-lg text-center">☞ [선착순 50명] 1:1 무료 진로 컨설팅, 오늘 마감!</span>
    </div>

    <!-- Exit Intent Modal - NEW: Updated for new CTA -->
    <div id="exit-intent-modal" class="modal-overlay">
        <div class="modal-content" onclick="event.stopPropagation()">
            <span class="modal-close" onclick="closeExitIntentModal()">×</span>
            <h2 class="text-2xl font-bold text-yellow-400 mb-4">잠깐! '크루즈 스탭'의<br>기회를 놓치시겠습니까?</h2>
            <p class="text-white mb-6">페이지를 나가시면 <strong class="text-cyan-400">50만원 상당 마케팅 특강</strong>과 <strong class="text-cyan-400">1:1 진로 컨설팅</strong> 기회가 영구히 사라집니다.</p>
            <ul class="text-left text-white space-y-2 mb-8">
                <li>✓ <strong class="text-yellow-400">[50만원 상당]</strong> 마케팅 특강 VOD</li>
                <li>✓ <strong class="text-yellow-400">[Priceless]</strong> 1:1 전문가 진로 컨설팅</li>
            </ul>
            <button onclick="document.getElementById('apply').scrollIntoView({ behavior: 'smooth' }); closeExitIntentModal();" class="cta-button w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xl py-4 rounded-full shadow-lg">
                무료 컨설팅 기회 잡기
            </button>
        </div>
    </div>

    <script>
        // --- Global Helper for Event Tracking ---
        function trackEvent(eventName, eventParams = {}) {
            console.log(\`[Tracking Event]: \${eventName}\`, eventParams);
        }

        // --- START: Google Sheet Integration ---
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw_4lTElhjJ3ZSTQuU15YlL56-rIhGcNZ1Itbojn3cWCcJD0YJ0_sMocc9fQwbu36zl/exec";

        document.addEventListener('DOMContentLoaded', () => {
            // --- Stats Counter (More realistic) ---
            const remainEl = document.getElementById('remainingSpots');
            const waitEl = document.getElementById('waitingList');
            if(remainEl && waitEl) {
                const updateStats = () => {
                    if (Math.random() > 0.3) {
                        const upStep = Math.floor(Math.random() * 3) + 1;
                        let curRemain = parseInt(remainEl.textContent, 10);
                        if (curRemain > 1) {
                            remainEl.textContent = curRemain - 1;
                            remainEl.classList.add('highlight');
                            setTimeout(() => remainEl.classList.remove('highlight'), 500);
                        }
                        waitEl.textContent = (parseInt(waitEl.textContent, 10)) + upStep;
                        waitEl.classList.add('highlight');
                        setTimeout(() => waitEl.classList.remove('highlight'), 500);
                    }
                    setTimeout(updateStats, Math.random() * 4000 + 2500);
                };
                setTimeout(updateStats, 3000);
            }

            // --- Countdown Timers ---
            const countdownElement = document.getElementById('countdown');
            if (countdownElement) {
                const countdown = () => {
                    const now = new Date(), endOfDay = new Date(now).setHours(23, 59, 59, 999), diff = endOfDay - now;
                    if (diff > 0) {
                        const h = String(Math.floor((diff/36e5)%24)).padStart(2,'0'), m = String(Math.floor((diff/6e4)%60)).padStart(2,'0'), s = String(Math.floor((diff/1e3)%60)).padStart(2,'0');
                        countdownElement.textContent = \`\${h}:\${m}:\${s}\`;
                    } else { countdownElement.textContent = "00:00:00"; }
                };
                setInterval(countdown, 1000); countdown();
            }
            
            // --- Social Proof Popup (More realistic) ---
            const socialProofPopup = document.getElementById('social-proof-popup');
            if (socialProofPopup) {
                const locations = ['서울', '부산', '인천', '대구', '경기', '경남', '제주'];
                const showPopup = () => {
                    const loc = locations[Math.floor(Math.random() * locations.length)], time = Math.floor(Math.random() * 15) + 2;
                    socialProofPopup.innerHTML = \`방금 \${loc}에서 컨설팅 신청 (\${time}분 전)\`;
                    socialProofPopup.classList.add('opacity-100', 'translate-y-0');
                    socialProofPopup.classList.remove('opacity-0', 'translate-y-5');
                    setTimeout(() => {
                        socialProofPopup.classList.remove('opacity-100', 'translate-y-0');
                        socialProofPopup.classList.add('opacity-0', 'translate-y-5');
                    }, 4000);
                };
                setTimeout(() => { showPopup(); setInterval(showPopup, 8500); }, 5000);
            }

            // --- Event Tracking for Form Views ---
            const observerOptions = { root: null, rootMargin: '0px', threshold: 0.5 };
            const observerCallback = (entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const formId = entry.target.id;
                        trackEvent('view_form', { form_location: formId });
                        observer.unobserve(entry.target);
                    }
                });
            };
            const formObserver = new IntersectionObserver(observerCallback, observerOptions);
            const mainFormSection = document.getElementById('apply');
            if (mainFormSection) formObserver.observe(mainFormSection);
            
            // --- Exit Intent Logic ---
            const exitModal = document.getElementById('exit-intent-modal');
            let hasShownExitIntent = sessionStorage.getItem('exitIntentShown');

            const showExitIntent = () => {
                if (!hasShownExitIntent && exitModal) {
                    exitModal.classList.add('active');
                    sessionStorage.setItem('exitIntentShown', 'true');
                    hasShownExitIntent = true;
                    trackEvent('view_exit_intent_modal');
                }
            };
            
            document.body.addEventListener('mouseleave', showExitIntent);
            
            let lastScrollTop = 0;
            window.addEventListener('scroll', () => {
                let st = window.pageYOffset || document.documentElement.scrollTop;
                if (st < lastScrollTop - 50 && lastScrollTop > 1200) { showExitIntent(); }
                lastScrollTop = st <= 0 ? 0 : st;
            }, false);

            window.addEventListener('popstate', function(){
                if (document.referrer === '' && !sessionStorage.getItem('exitIntentShown')) {
                    showExitIntent();
                }
            });

        }); // END DOMContentLoaded

        // --- Modal Functions (Global Scope) ---
        const videoModal = document.getElementById('video-modal'), playerContainer = document.getElementById('video-player-container');
        function playVideo(src) { if(playerContainer && videoModal) { playerContainer.innerHTML = \`<iframe src="\${src}" style="position:absolute;top:0;left:0;width:100%;height:100%;" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>\`; videoModal.classList.add('active'); } }
        function closeModal() { if(playerContainer && videoModal) { playerContainer.innerHTML = ''; videoModal.classList.remove('active'); } }
        const imageModal = document.getElementById('image-modal'), modalImage = document.getElementById('modal-image');
        function showImage(src) { if(modalImage && imageModal) { modalImage.src = src; imageModal.classList.add('active'); } }
        function closeImageModal() { if(imageModal) { imageModal.classList.remove('active'); } }
        const exitIntentModal = document.getElementById('exit-intent-modal');
        function closeExitIntentModal() { if(exitIntentModal) { exitIntentModal.classList.remove('active'); } }
    </script>
</body>
</html>`;
