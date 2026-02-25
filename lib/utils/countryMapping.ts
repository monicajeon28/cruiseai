// lib/utils/countryMapping.ts
// 국가 코드와 한국어 이름 간 매핑 유틸리티

import countriesData from '@/data/countries.json';

// 국가 코드 -> 한국어 이름 매핑 생성
export const COUNTRY_CODE_TO_KOREAN_NAME: Record<string, string> = (() => {
  const map: Record<string, string> = {};

  (countriesData as any[]).forEach(continent => {
    (continent.countries || []).forEach((country: any) => {
      const countryName = country.name;
      if (!countryName) return;

      // "대한민국 (South Korea)" 형식에서 한국어 이름 추출
      const koreanName = countryName.split(' (')[0].trim();

      // 국가 코드 추출 (ISO 3166-1 alpha-2 코드)
      // 일반적인 국가 코드 매핑
      const codeMap: Record<string, string> = {
        '대한민국': 'KR',
        '홍콩': 'HK',
        '일본': 'JP',
        '중국': 'CN',
        '대만': 'TW',
        '싱가포르': 'SG',
        '태국': 'TH',
        '베트남': 'VN',
        '필리핀': 'PH',
        '인도네시아': 'ID',
        '말레이시아': 'MY',
        '미국': 'US',
        '캐나다': 'CA',
        '멕시코': 'MX',
        '영국': 'GB',
        '프랑스': 'FR',
        '독일': 'DE',
        '이탈리아': 'IT',
        '스페인': 'ES',
        '그리스': 'GR',
        '네덜란드': 'NL',
        '벨기에': 'BE',
        '스위스': 'CH',
        '오스트리아': 'AT',
        '포르투갈': 'PT',
        '러시아': 'RU',
        '터키': 'TR',
        '이집트': 'EG',
        '모로코': 'MA',
        '남아프리카 공화국': 'ZA',
        '호주': 'AU',
        '뉴질랜드': 'NZ',
        '브라질': 'BR',
        '아르헨티나': 'AR',
        '칠레': 'CL',
        '페루': 'PE',
        '콜롬비아': 'CO',
        '에콰도르': 'EC',
        '우루과이': 'UY',
        '파라과이': 'PY',
        '볼리비아': 'BO',
        '베네수엘라': 'VE',
        '가이아나': 'GY',
        '수리남': 'SR',
        '파나마': 'PA',
        '코스타리카': 'CR',
        '니카라과': 'NI',
        '온두라스': 'HN',
        '엘살바도르': 'SV',
        '벨리즈': 'BZ',
        '과테말라': 'GT',
        '쿠바': 'CU',
        '자메이카': 'JM',
        '도미니카 공화국': 'DO',
        '아이티': 'HT',
        '바하마': 'BS',
        '트리니다드 토바고': 'TT',
        '바베이도스': 'BB',
        '그레나다': 'GD',
        '세인트빈센트 그레나딘': 'VC',
        '세인트루시아': 'LC',
        '도미니카 연방': 'DM',
        '앤티가 바부다': 'AG',
        '세인트키츠 네비스': 'KN',
        '피지': 'FJ',
        '파푸아뉴기니': 'PG',
        '솔로몬 제도': 'SB',
        '바누아투': 'VU',
        '사모아': 'WS',
        '통가': 'TO',
        '키리바시': 'KI',
        '미크로네시아 연방': 'FM',
        '팔라우': 'PW',
        '마셜 제도': 'MH',
        '나우루': 'NR',
        '투발루': 'TV',
        '노르웨이': 'NO',
        '스웨덴': 'SE',
        '덴마크': 'DK',
        '핀란드': 'FI',
        '아이슬란드': 'IS',
        '아일랜드': 'IE',
        '폴란드': 'PL',
        '체코': 'CZ',
        '슬로바키아': 'SK',
        '슬로베니아': 'SI',
        '크로아티아': 'HR',
        '보스니아 헤르체고비나': 'BA',
        '세르비아': 'RS',
        '몬테네그로': 'ME',
        '북마케도니아': 'MK',
        '알바니아': 'AL',
        '불가리아': 'BG',
        '루마니아': 'RO',
        '헝가리': 'HU',
        '우크라이나': 'UA',
        '벨라루스': 'BY',
        '리투아니아': 'LT',
        '라트비아': 'LV',
        '에스토니아': 'EE',
        '몰도바': 'MD',
        '조지아': 'GE',
        '아르메니아': 'AM',
        '아제르바이잔': 'AZ',
        '카자흐스탄': 'KZ',
        '우즈베키스탄': 'UZ',
        '투르크메니스탄': 'TM',
        '타지키스탄': 'TJ',
        '키르기스스탄': 'KG',
        '아프가니스탄': 'AF',
        '파키스탄': 'PK',
        '인도': 'IN',
        '방글라데시': 'BD',
        '스리랑카': 'LK',
        '몰디브': 'MV',
        '네팔': 'NP',
        '부탄': 'BT',
        '미얀마': 'MM',
        '라오스': 'LA',
        '캄보디아': 'KH',
        '브루나이': 'BN',
        '동티모르': 'TL',
        '몽골': 'MN',
        '북한': 'KP',
        '사우디아라비아': 'SA',
        '아랍에미리트': 'AE',
        '카타르': 'QA',
        '바레인': 'BH',
        '쿠웨이트': 'KW',
        '오만': 'OM',
        '예멘': 'YE',
        '이라크': 'IQ',
        '이란': 'IR',
        '이스라엘': 'IL',
        '팔레스타인': 'PS',
        '요르단': 'JO',
        '레바논': 'LB',
        '시리아': 'SY',
        '키프로스': 'CY',
        '몰타': 'MT',
        '모나코': 'MC',
        '산마리노': 'SM',
        '바티칸 시국': 'VA',
        '리히텐슈타인': 'LI',
        '안도라': 'AD',
        '룩셈부르크': 'LU',
        '튀르키예': 'TR',
        '알제리': 'DZ',
        '튀니지': 'TN',
        '리비아': 'LY',
        '수단': 'SD',
        '남수단': 'SS',
        '에티오피아': 'ET',
        '에리트레아': 'ER',
        '지부티': 'DJ',
        '소말리아': 'SO',
        '케냐': 'KE',
        '우간다': 'UG',
        '르완다': 'RW',
        '부룬디': 'BI',
        '콩고 민주 공화국': 'CD',
        '콩고 공화국': 'CG',
        '기니': 'GN',
        '시에라리온': 'SL',
        '라이베리아': 'LR',
        '코트디부아르': 'CI',
        '가나': 'GH',
        '모잠비크': 'MZ',
        '말라위': 'MW',
        '잠비아': 'ZM',
        '짐바브웨': 'ZW',
        '보츠와나': 'BW',
        '나미비아': 'NA',
        '레소토': 'LS',
        '에스와티니': 'SZ',
        '모리셔스': 'MU',
        '세이셸': 'SC',
        '마다가스카르': 'MG',
        '코모로': 'KM',
        '카보베르데': 'CV',
        '서사하라': 'EH',
        '모리타니': 'MR',
      };

      const code = codeMap[koreanName];
      if (code) {
        map[code] = koreanName;
      }
    });
  });

  return map;
})();

// 한국어 이름 -> 국가 코드 매핑 생성
export const KOREAN_NAME_TO_COUNTRY_CODE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  Object.entries(COUNTRY_CODE_TO_KOREAN_NAME).forEach(([code, name]) => {
    map[name] = code;
  });
  return map;
})();

// 국가 코드를 한국어 이름으로 변환
export function getKoreanCountryName(countryCode: string): string | null {
  return COUNTRY_CODE_TO_KOREAN_NAME[countryCode.toUpperCase()] || null;
}

// 한국어 이름을 국가 코드로 변환
export function getCountryCode(koreanName: string): string | null {
  return KOREAN_NAME_TO_COUNTRY_CODE[koreanName] || null;
}

// 국가 코드 배열을 한국어 이름 배열로 변환
export function convertCountryCodesToKoreanNames(codes: string[]): string[] {
  return codes
    .map(code => getKoreanCountryName(code))
    .filter((name): name is string => name !== null);
}

// 한국어 이름 배열을 국가 코드 배열로 변환
export function convertKoreanNamesToCountryCodes(names: string[]): string[] {
  return names
    .map(name => {
      // "스페인 (Spain)" 형식에서 한국어 이름만 추출
      const koreanName = name.split(' (')[0].trim();
      return getCountryCode(koreanName);
    })
    .filter((code): code is string => code !== null);
}

