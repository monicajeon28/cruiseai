'use client';

import { useState, useEffect } from 'react';
import { FiPhone, FiClock, FiMessageCircle, FiChevronRight } from 'react-icons/fi';

interface FooterItem {
  id: string;
  name: string;
  link: string;
  icon?: string | null;
  order: number;
}

interface CompanyInfoLine {
  id: string;
  text: string;
  order: number;
}

interface FooterData {
  customerCenter: {
    title: string;
    phone: string;
    operatingHours: string;
    holidayInfo: string;
    consultButton: {
      enabled: boolean;
      text: string;
      link: string;
      icon: string | null;
    };
  };
  faqSection: {
    title: string;
    enabled: boolean;
    items: FooterItem[];
  };
  genieButton: {
    enabled: boolean;
    name: string;
    link: string;
    icon: string | null;
    gradient: string;
  };
  bottomLinks: FooterItem[];
  companyInfo: {
    lines: CompanyInfoLine[];
  };
  copyright: {
    text: string;
    poweredBy: {
      text: string;
      company: string;
      link: string;
    };
  };
}

/**
 * 공개 페이지용 푸터
 * 판매몰, 유튜브, 후기, 커뮤니티 페이지에서 사용
 */
export default function PublicFooter() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [footerData, setFooterData] = useState<FooterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Footer 데이터 로드
  useEffect(() => {
    const loadFooterData = async () => {
      try {
        const res = await fetch('/api/public/footer');
        const data = await res.json();
        if (data.ok && data.data) {
          setFooterData(data.data);
        }
      } catch (error) {
        console.error('[PublicFooter] Failed to load footer data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadFooterData();
  }, []);

  if (isLoading || !footerData) {
    return (
      <footer className="bg-[#051C2C] text-[#F9F7F2]/80">
        <div className="max-w-7xl mx-auto px-6 py-12 text-center">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </footer>
    );
  }

  const sortedFaqItems = [...footerData.faqSection.items].sort((a, b) => a.order - b.order);
  const sortedBottomLinks = [...footerData.bottomLinks].sort((a, b) => a.order - b.order);
  const sortedCompanyInfoLines = [...footerData.companyInfo.lines].sort((a, b) => a.order - b.order);

  return (
    <footer className="bg-[#051C2C] text-[#F9F7F2]/80">
      {/* 상단 섹션 - 고객센터 & FAQ */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* 고객센터 */}
          <div>
            <h3 className="text-[#D4AF37] text-lg font-bold mb-4">{footerData.customerCenter.title}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <FiPhone className="text-[#D4AF37]" size={20} />
                <a href={`tel:${footerData.customerCenter.phone.replace(/-/g, '')}`} className="text-xl font-bold text-white hover:text-[#D4AF37] transition-colors">
                  {footerData.customerCenter.phone}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <FiClock className="text-[#D4AF37]" size={20} />
                <span>{footerData.customerCenter.operatingHours}</span>
              </div>
              <div className="text-sm text-banana-cream/60">
                {footerData.customerCenter.holidayInfo}
              </div>
              {footerData.customerCenter.consultButton.enabled && (
                <a
                  href={footerData.customerCenter.consultButton.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 bg-[#D4AF37] text-[#051C2C] px-6 py-3 rounded-lg hover:bg-yellow-500 font-semibold transition-colors cursor-pointer shadow-md"
                >
                  {footerData.customerCenter.consultButton.icon ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={footerData.customerCenter.consultButton.icon} alt="" className="w-5 h-5" />
                  ) : (
                    <FiMessageCircle />
                  )}
                  {footerData.customerCenter.consultButton.text}
                </a>
              )}
            </div>
          </div>

          {/* FAQ/문의하기 - 탭 형태 */}
          {footerData.faqSection.enabled && (
            <div>
              <h3 className="text-[#D4AF37] text-lg font-bold mb-4">{footerData.faqSection.title}</h3>
              <div className="space-y-2">
                {sortedFaqItems.map((tab) => (
                  <a
                    key={tab.id}
                    href={tab.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-[#051C2C]/50 border border-[#D4AF37]/20 hover:bg-[#051C2C] hover:border-[#D4AF37] text-[#F9F7F2] transition-colors group cursor-pointer"
                    onMouseEnter={() => setActiveTab(tab.id)}
                    onMouseLeave={() => setActiveTab(null)}
                  >
                    <div className="flex items-center gap-2">
                      {tab.icon && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={tab.icon} alt="" className="w-5 h-5" />
                      )}
                      <span className="font-medium">{tab.name}</span>
                    </div>
                    <FiChevronRight
                      className={`transition-transform ${activeTab === tab.id ? 'translate-x-1' : ''}`}
                      size={18}
                    />
                  </a>
                ))}
                {/* 크루즈 지니 AI 3일 무료체험 링크 */}
                {footerData.genieButton.enabled && (
                  <a
                    href={footerData.genieButton.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between p-3 rounded-lg bg-gradient-to-r ${footerData.genieButton.gradient} hover:opacity-90 text-white transition-all group cursor-pointer font-semibold shadow-lg`}
                    onMouseEnter={() => setActiveTab('test')}
                    onMouseLeave={() => setActiveTab(null)}
                  >
                    <div className="flex items-center gap-2">
                      {footerData.genieButton.icon && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={footerData.genieButton.icon} alt="" className="w-5 h-5" />
                      )}
                      <span className="font-medium">{footerData.genieButton.name}</span>
                    </div>
                    <FiChevronRight
                      className={`transition-transform ${activeTab === 'test' ? 'translate-x-1' : ''}`}
                      size={18}
                    />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 구분선 */}
      <div className="border-t border-banana-gold/10"></div>

      {/* 하단 섹션 - 회사 정보 */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 링크 */}
        <div className="flex flex-wrap gap-4 mb-6 text-sm">
          {sortedBottomLinks.map((link, index) => (
            <div key={link.id} className="flex items-center gap-4">
              {index > 0 && <span className="text-banana-cream/40">|</span>}
              <a
                href={link.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`hover:text-white ${link.name === '개인정보처리방침' ? 'font-semibold text-banana-gold hover:text-yellow-300' : ''}`}
              >
                {link.name}
              </a>
            </div>
          ))}
        </div>

        {/* 회사 정보 */}
        <div className="space-y-2 text-sm text-banana-cream/50">
          {sortedCompanyInfoLines.map((line) => (
            <div key={line.id} dangerouslySetInnerHTML={{ __html: line.text.replace(/<strong>(.*?)<\/strong>/g, '<strong class="text-banana-cream/80">$1</strong>') }} />
          ))}
        </div>

        {/* Copyright */}
        <div className="mt-6 pt-6 border-t border-banana-gold/10 text-sm text-banana-cream/40">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2">
            <p>{footerData.copyright.text}</p>
            <p>
              {footerData.copyright.poweredBy.text}{' '}
              <a
                href={footerData.copyright.poweredBy.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-banana-gold/60 font-semibold hover:underline"
              >
                {footerData.copyright.poweredBy.company}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
