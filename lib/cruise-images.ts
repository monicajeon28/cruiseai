// lib/cruise-images.ts
// 크루즈정보사진 폴더에서 여행지 이미지를 가져오는 유틸리티

import * as fs from 'fs';
import * as path from 'path';

interface ImageInfo {
  url: string;
  title: string;
}

/**
 * 여행지에 맞는 이미지를 크루즈정보사진 폴더에서 찾아서 반환
 * 크루즈정보사진 원본 폴더 사용 (백업 폴더는 삭제되었으므로 원본만 사용)
 */
export function getDestinationImages(destinations: string[]): ImageInfo[] {
  const images: ImageInfo[] = [];
  const photosDir = path.join(process.cwd(), 'public', '크루즈정보사진');
  
  if (!fs.existsSync(photosDir)) {
    return images;
  }

  // 목적지 키워드 매핑
  const destinationKeywords: Record<string, string[]> = {
    '대한민국': ['대한민국', '한국', 'korea', 'jeju'],
    '일본': ['일본', 'japan', '도쿄', 'tokyo', '후쿠오카', 'fukuoka', '오키나와', 'okinawa', '나가사키', 'nagasaki', '사세보', 'sasebo', '요코하마', 'yokohama'],
    '홍콩': ['홍콩', 'hongkong', 'hong kong'],
    '대만': ['대만', 'taiwan', '타이완', 'taipei'],
    '싱가포르': ['싱가포르', 'singapore'],
    '베트남': ['베트남', 'vietnam', '호치민', 'hochiminh', '다낭', 'danang', '하롱', 'halong'],
    '말레이시아': ['말레이시아', 'malaysia', '쿠알라룸푸르', 'kuala lumpur', '페낭', 'penang'],
    '태국': ['태국', 'thailand', '방콕', 'bangkok', '푸켓', 'phuket'],
    '필리핀': ['필리핀', 'philippines', '세부', 'cebu', '마닐라', 'manila'],
  };

  // 검색할 키워드 수집
  const searchKeywords: string[] = [];
  destinations.forEach(dest => {
    const keywords = destinationKeywords[dest] || [dest];
    searchKeywords.push(...keywords);
  });

  // 폴더 검색 함수
  function searchDirectory(dirPath: string, relativePath: string = '', maxDepth: number = 6): void {
    if (maxDepth < 0) return;
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const itemRelativePath = path.join(relativePath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          if (maxDepth === 0) {
            continue;
          }
          searchDirectory(itemPath, itemRelativePath, maxDepth - 1);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
          
          if (imageExtensions.includes(ext)) {
            const fileNameLower = item.toLowerCase();
            const relativeLower = itemRelativePath.toLowerCase();
            const hasMatch = searchKeywords.some(keyword => {
              const lower = keyword.toLowerCase();
              return fileNameLower.includes(lower) || relativeLower.includes(lower);
            });
            
            if (hasMatch) {
              try {
                const filePath = path.join(dirPath, item);
                const fileStat = fs.statSync(filePath);
                
                if (fileStat.isFile() && fileStat.size > 0) {
                  fs.accessSync(filePath, fs.constants.R_OK);
                  
                  const normalizedPath = itemRelativePath.replace(/\\/g, '/');
                  const pathParts = normalizedPath.split('/').filter(Boolean);
                  const encodedUrl = `/크루즈정보사진/${pathParts.map(encodeURIComponent).join('/')}`;

                  images.push({
                    url: encodedUrl,
                    title: item.replace(/\.[^/.]+$/, ''), // 확장자 제거
                  });
                }
              } catch (error) {
                console.warn(`[Cruise Images] Skipping inaccessible file: ${itemRelativePath}`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`[Cruise Images] Error searching directory ${dirPath}:`, error);
    }
  }

  searchDirectory(photosDir);
  
  // 중복 제거 및 반환 (최대 5장만)
  const uniqueImages = Array.from(
    new Map(images.map(img => [img.url, img])).values()
  );

  return uniqueImages.slice(0, 5);
}

/**
 * 크루즈 후기 사진 9장 가져오기 (3x3 그리드용)
 */
export function getCruiseReviewImages(
  _productInfo: {
    packageName?: string;
    itineraryPattern?: string;
  },
  limit: number = 10,
): ImageInfo[] {
  // 실제 폴더 경로: "고객 후기 자료"
  // 크루즈정보사진 원본 폴더 사용 (백업 폴더는 삭제되었으므로 원본만 사용)
  const reviewDir = path.join(process.cwd(), 'public', '크루즈정보사진', '고객 후기 자료');
  if (!fs.existsSync(reviewDir)) {
    console.warn('[Cruise Images] Review directory not found:', reviewDir);
    return [];
  }

  const images: ImageInfo[] = [];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  const walk = (dirPath: string, relativePath = '', depth = 4) => {
    if (images.length >= limit || depth < 0) return;
    
    try {
      // 디렉토리가 존재하는지 확인
      if (!fs.existsSync(dirPath)) {
        return;
      }
      
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        return;
      }
      
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelative = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          walk(entryPath, entryRelative, depth - 1);
          if (images.length >= limit) return;
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!imageExtensions.includes(ext)) continue;

          // 코스타 필터 제거 - 모든 크루즈 사진 포함 (Q2에서 사용)
          // const normalizedName = entryRelative.toLowerCase();
          // if (!normalizedName.includes('코스타') && !normalizedName.includes('costa')) {
          //   continue;
          // }

          try {
            const stat = fs.statSync(entryPath);
            if (stat.size <= 0) continue;
            fs.accessSync(entryPath, fs.constants.R_OK);

            const normalized = entryRelative.replace(/\\/g, '/');
            const parts = normalized.split('/').filter(Boolean);
            const url = `/크루즈정보사진/고객 후기 자료/${parts.map(encodeURIComponent).join('/')}`;

            images.push({
              url,
              title: entry.name.replace(/\.[^/.]+$/, ''), // 확장자 제거
            });
          } catch (error) {
            console.warn(`[Cruise Images] Skipping inaccessible file: ${entryRelative}`, error);
          }
        }
      }
    } catch (error) {
      // 디렉토리 접근 실패 시 무시하고 계속 진행
      console.warn(`[Cruise Images] Failed to access directory ${dirPath}:`, error);
    }
  };

  walk(reviewDir);

  const uniqueImages = Array.from(new Map(images.map((img) => [img.url, img])).values());
  return uniqueImages.slice(0, limit);
}

/**
 * 상품 정보에서 목적지를 추출하여 이미지 가져오기
 */
export function getProductDestinationImages(productInfo: {
  packageName?: string;
  itineraryPattern?: string;
}): ImageInfo[] {
  const destinationCountryMap: Record<string, string> = {
    '대한민국': '대한민국',
    '한국': '대한민국',
    'JEJU': '대한민국',
    '제주': '대한민국',
    '일본': '일본',
    'JAPAN': '일본',
    '도쿄': '일본',
    'TOKYO': '일본',
    '후쿠오카': '일본',
    'FUKUOKA': '일본',
    '사세보': '일본',
    'SASEBO': '일본',
    '나가사키': '일본',
    'NAGASAKI': '일본',
    '오키나와': '일본',
    'OKINAWA': '일본',
    '요코하마': '일본',
    'YOKOHAMA': '일본',
    '홍콩': '홍콩',
    'HONGKONG': '홍콩',
    'HONG KONG': '홍콩',
    '대만': '대만',
    '타이완': '대만',
    'TAIWAN': '대만',
    '싱가포르': '싱가포르',
    'SINGAPORE': '싱가포르',
    '베트남': '베트남',
    'VIETNAM': '베트남',
    '다낭': '베트남',
    'DANANG': '베트남',
    '호치민': '베트남',
    'HO CHI MINH': '베트남',
    '말레이시아': '말레이시아',
    'MALAYSIA': '말레이시아',
    '쿠알라룸푸르': '말레이시아',
    'KUALA LUMPUR': '말레이시아',
    '태국': '태국',
    'THAILAND': '태국',
    '방콕': '태국',
    'BANGKOK': '태국',
    '푸켓': '태국',
    'PHUKET': '태국',
    '필리핀': '필리핀',
    'PHILIPPINES': '필리핀',
    '세부': '필리핀',
    'CEBU': '필리핀',
    '마닐라': '필리핀',
    'MANILA': '필리핀',
  };

  const countries = new Set<string>();

  const addCountriesFromText = (text?: string | any) => {
    if (!text) return;
    // text가 문자열이 아니면 문자열로 변환
    const textStr = typeof text === 'string' ? text : String(text);
    const upper = textStr.toUpperCase();
    Object.entries(destinationCountryMap).forEach(([keyword, country]) => {
      if (upper.includes(keyword)) {
        countries.add(country);
      }
    });
  };

  // packageName에서 국가 추출
  addCountriesFromText(productInfo.packageName);
  
  // itineraryPattern 처리 (JSON 형식일 수도 있음)
  if (productInfo.itineraryPattern) {
    // itineraryPattern이 문자열인지 확인
    if (typeof productInfo.itineraryPattern === 'string') {
      try {
        // JSON 형식인지 확인
        const parsed = JSON.parse(productInfo.itineraryPattern);
        if (Array.isArray(parsed)) {
          // JSON 배열인 경우: 각 항목의 country, location 필드에서 국가 추출
          parsed.forEach((item: any) => {
            if (item.country) {
              // country 코드를 국가명으로 변환 (예: "JP" -> "일본")
              const countryCodeMap: Record<string, string> = {
                'KR': '대한민국',
                'JP': '일본',
                'TW': '대만',
                'HK': '홍콩',
                'SG': '싱가포르',
                'VN': '베트남',
                'MY': '말레이시아',
                'TH': '태국',
                'PH': '필리핀',
              };
              const countryName = countryCodeMap[item.country] || item.country;
              countries.add(countryName);
            }
            if (item.location) {
              addCountriesFromText(item.location);
            }
          });
        } else {
          // JSON 객체인 경우
          addCountriesFromText(JSON.stringify(parsed));
        }
      } catch (e) {
        // JSON이 아닌 경우 일반 문자열로 처리
        addCountriesFromText(productInfo.itineraryPattern);
      }
    } else if (Array.isArray(productInfo.itineraryPattern)) {
      // 이미 배열인 경우 (직접 전달된 경우)
      (productInfo.itineraryPattern as any[]).forEach((item: any) => {
        if (item && typeof item === 'object') {
          if (item.country) {
            const countryCodeMap: Record<string, string> = {
              'KR': '대한민국',
              'JP': '일본',
              'TW': '대만',
              'HK': '홍콩',
              'SG': '싱가포르',
              'VN': '베트남',
              'MY': '말레이시아',
              'TH': '태국',
              'PH': '필리핀',
            };
            const countryName = countryCodeMap[item.country] || item.country;
            countries.add(countryName);
          }
          if (item.location) {
            addCountriesFromText(item.location);
          }
        }
      });
    } else if (typeof productInfo.itineraryPattern === 'object') {
      // 객체인 경우 문자열로 변환하여 처리
      addCountriesFromText(JSON.stringify(productInfo.itineraryPattern));
    }
  }

  return getDestinationImages(Array.from(countries));
}

/**
 * 객실 이미지 가져오기 (크루즈정보사진 폴더에서)
 * 크루즈정보사진 원본 폴더 사용 (백업 폴더는 삭제되었으므로 원본만 사용)
 */
export function getRoomImages(limit: number = 3): ImageInfo[] {
  const images: ImageInfo[] = [];
  const photosDir = path.join(process.cwd(), 'public', '크루즈정보사진');
  
  if (!fs.existsSync(photosDir)) {
    return images;
  }

  // 객실 관련 키워드
  const roomKeywords = ['객실', '룸', 'room', '인사이드', '오션뷰', '발코니', 'balcony', 'inside', 'ocean'];

  // 폴더 검색 함수
  function searchDirectory(dirPath: string, relativePath: string = '', maxDepth: number = 6): void {
    if (maxDepth < 0) return;
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const itemRelativePath = path.join(relativePath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          if (maxDepth === 0) {
            continue;
          }
          searchDirectory(itemPath, itemRelativePath, maxDepth - 1);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
          
          if (imageExtensions.includes(ext)) {
            const fileNameLower = item.toLowerCase();
            const relativeLower = itemRelativePath.toLowerCase();
            const hasMatch = roomKeywords.some(keyword => {
              const lower = keyword.toLowerCase();
              return fileNameLower.includes(lower) || relativeLower.includes(lower);
            });
            
            if (hasMatch) {
              try {
                const filePath = path.join(dirPath, item);
                const fileStat = fs.statSync(filePath);
                
                if (fileStat.isFile() && fileStat.size > 0) {
                  fs.accessSync(filePath, fs.constants.R_OK);
                  
                  const normalizedPath = itemRelativePath.replace(/\\/g, '/');
                  const pathParts = normalizedPath.split('/').filter(Boolean);
                  const encodedUrl = `/크루즈정보사진/${pathParts.map(encodeURIComponent).join('/')}`;

                  images.push({
                    url: encodedUrl,
                    title: item.replace(/\.[^/.]+$/, ''), // 확장자 제거
                  });
                }
              } catch (error) {
                console.warn(`[Cruise Images] Skipping inaccessible file: ${itemRelativePath}`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`[Cruise Images] Error searching directory ${dirPath}:`, error);
    }
  }

  searchDirectory(photosDir);
  
  // 중복 제거 및 제한
  const uniqueImages = Array.from(
    new Map(images.map(img => [img.url, img])).values()
  );

  return uniqueImages.slice(0, limit);
}

