
import prisma from '@/lib/prisma';

export const DRIVE_CONFIG_KEYS = {
    SIGNATURES: 'google_drive_signatures_folder_id',
    PASSPORTS: 'google_drive_passport_folder_id',
    ID_CARDS: 'google_drive_id_card_folder_id',
    BANKBOOKS: 'google_drive_bankbook_folder_id',
    B2B_BACKUP: 'google_drive_b2b_backup_folder_id',
    MEETING_RECORDINGS: 'google_drive_meeting_recordings_folder_id',
    PROFILES: 'google_drive_profiles_folder_id',
    PRODUCTS: 'google_drive_products_folder_id',
    CONTRACTS: 'google_drive_contracts_folder_id',
    AFFILIATE_DOCUMENTS: 'google_drive_affiliate_documents_folder_id',
    APIS_BACKUP: 'google_drive_apis_backup_folder_id',
    LEADS_BACKUP: 'google_drive_leads_backup_folder_id',
    SALES_BACKUP: 'google_drive_sales_backup_folder_id',
    SETTLEMENTS_BACKUP: 'google_drive_settlements_backup_folder_id',
    TRAVEL_GUIDES: 'google_drive_travel_guides_folder_id',
    UPLOADS_IMAGES: 'google_drive_uploads_images_folder_id',
    UPLOADS_REVIEWS: 'google_drive_uploads_reviews_folder_id', // 커뮤니티 리뷰 이미지
    UPLOADS_VIDEOS: 'google_drive_uploads_videos_folder_id', // 동영상 업로드
    UPLOADS_FONTS: 'google_drive_uploads_fonts_folder_id', // 폰트 업로드
    UPLOADS_DOCUMENTS: 'google_drive_uploads_documents_folder_id', // 문서 업로드
    UPLOADS_SALES_AUDIO: 'google_drive_uploads_sales_audio_folder_id', // 구매확인 오디오 파일
    UPLOADS_AUDIO: 'google_drive_uploads_audio_folder_id', // 일반 상담 기록 오디오 파일
    CRUISE_IMAGES: 'google_drive_cruise_images_folder_id', // 크루즈 사진 다운로드용
    APIS_MAIN: 'google_drive_apis_main_folder_id',
    APIS_TEMPLATE_ID: 'google_drive_apis_template_id',
    ROOT: 'google_drive_root_folder_id',
    CASHFLOW: 'google_drive_cashflow_folder_id', // 판매원별 수당 엑셀
    TOTALCASH: 'google_drive_totalcash_folder_id', // 거래처용 월별 엑셀
    BACKUP_LOGS: 'google_drive_backup_logs_folder_id', // 백업 로그
} as const;

export type DriveConfigKey = keyof typeof DRIVE_CONFIG_KEYS;

// Default Fallbacks (from existing code or user provided)
export const DEFAULTS: Record<DriveConfigKey, string> = {
    SIGNATURES: '1PcdSnWQ3iCdd87Y-UI_63HSjlYqcFGyX', // 계약서 싸인 이미지
    PASSPORTS: '1Nen5t7rE8WaT9e4xWswSiUNJIcgMiDRF', // 여권 이미지
    ID_CARDS: '1DFWpAiS-edjiBym5Y5AonDOl2wXyuDV0', // 신분증
    BANKBOOKS: '1IjNSTTTBjU9NZE6fm6DeAAHBx4puWCRl', // 통장사본
    B2B_BACKUP: '1_svzM0e22cLbgABfRHa9__Xtgi46q2nZ', // Backups/B2B_Leads
    MEETING_RECORDINGS: '1dhTmPheRvOsc0V0ukpKOqD2Ry1IN-OrH', // 구매고객 녹음 파일
    PRODUCTS: '18YuEBt313yyKI3F7PSzjFFRF3Af-bVPH', // 상품 이미지
    PROFILES: '13roFq5i51155_DG4MR74dqyWrR6GRAG9', // 프로필 이미지
    CONTRACTS: '1HN-w4tNLdmfW5K5N3zF52P_InrUdBkQ_', // 모든 계약서
    AFFILIATE_DOCUMENTS: '1vPvuzpdNqGd1JAUK3zNMVkcF_9kRQMGI',
    APIS_BACKUP: '1XirPBgHqPq1fmTBjYAqtGEDmCNMzpZDB', // Backups/APIS
    LEADS_BACKUP: '1u3ntHUQHR1AQYqXBsZVdDhGV6eIOLkE6', // Backups/Leads
    SALES_BACKUP: '1XQk6nou684nm75djLgDq6eejvJUbWGXg', // Backups/Sales_Data
    SETTLEMENTS_BACKUP: '1oEzUJWJezJPAP-bGZY3do2oVN7eYJ09D', // Backups/Settlements
    TRAVEL_GUIDES: '17QT8_NTQXpOzcfaZ3silp-hqD0sgOAck', // 크루즈정보사진 (Travel Guides)
    UPLOADS_IMAGES: '1fWbPelIoftl1DqXLayZNle7z-DSYzvl8', // 이미지 라이브러리 업로드용 (User Requested Enforcement)
    UPLOADS_REVIEWS: '1E5iho6Ud7wFLs3Nkp3LGHMKXoN7MYVpO', // 커뮤니티 리뷰 이미지
    UPLOADS_VIDEOS: '1VAZ9bOEV47keU-mJNhlwlgGHi6ONaFFI', // 동영상 업로드
    UPLOADS_FONTS: '1LgxTEm_1pue1XFduypj9YnMStCarxfOt', // 폰트 업로드
    UPLOADS_DOCUMENTS: '1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz', // 문서 업로드
    UPLOADS_SALES_AUDIO: '1g8vNIeXEVHkavQnlBAXsBMkVZB_Y29Fk', // 구매확인 오디오 파일
    UPLOADS_AUDIO: '1XfdoQrODfjZOaQzV6X859fE2mCG4QuwY', // 일반 상담 기록 오디오 파일
    CRUISE_IMAGES: '17QT8_NTQXpOzcfaZ3silp-hqD0sgOAck', // 크루즈 사진 다운로드용
    APIS_MAIN: '185t2eIIPDsEm-QW9KmhTbxkrywFJhGdk', // 여행별 APIS 메인 폴더
    APIS_TEMPLATE_ID: '1Le6IPNzyvMqpn-6ZnqgvH0JTQ8O5rKymWMU_pkfbQ5Q', // APIS 양식 시트
    ROOT: '0AJVz1C-KYWR0Uk9PVA',
    CASHFLOW: '1kv9XlTFLh8QqTlDvakwaxB_LtTQxv6Hx', // 판매원별 수당 엑셀
    TOTALCASH: '1GC4hwjkVNqUmBGhaE5PmldoMr0WUEkGo', // 거래처용 월별 엑셀
    BACKUP_LOGS: '1u3ntHUQHR1AQYqXBsZVdDhGV6eIOLkE6', // 백업 로그 (Leads_Backup과 동일)
};

// Env Var Mapping
export const ENV_MAPPING: Record<DriveConfigKey, string | undefined> = {
    SIGNATURES: process.env.GOOGLE_DRIVE_SIGNATURES_FOLDER_ID,
    PASSPORTS: process.env.GOOGLE_DRIVE_PASSPORT_FOLDER_ID,
    ID_CARDS: process.env.GOOGLE_DRIVE_ID_CARD_FOLDER_ID,
    BANKBOOKS: process.env.GOOGLE_DRIVE_BANKBOOK_FOLDER_ID,
    B2B_BACKUP: process.env.GOOGLE_DRIVE_B2B_BACKUP_FOLDER_ID,
    MEETING_RECORDINGS: process.env.GOOGLE_DRIVE_MEETING_RECORDINGS_FOLDER_ID,
    PRODUCTS: process.env.GOOGLE_DRIVE_PRODUCTS_FOLDER_ID,
    PROFILES: process.env.GOOGLE_DRIVE_UPLOADS_PROFILES_FOLDER_ID,
    CONTRACTS: process.env.GOOGLE_DRIVE_CONTRACTS_FOLDER_ID,
    AFFILIATE_DOCUMENTS: process.env.GOOGLE_DRIVE_AFFILIATE_INFO_FOLDER_ID,
    APIS_BACKUP: process.env.GOOGLE_DRIVE_APIS_BACKUP_FOLDER_ID,
    LEADS_BACKUP: process.env.GOOGLE_DRIVE_LEADS_BACKUP_FOLDER_ID,
    SALES_BACKUP: process.env.GOOGLE_DRIVE_SALES_BACKUP_FOLDER_ID,
    SETTLEMENTS_BACKUP: process.env.GOOGLE_DRIVE_SETTLEMENTS_BACKUP_FOLDER_ID,
    TRAVEL_GUIDES: process.env.GOOGLE_DRIVE_TRAVEL_GUIDES_FOLDER_ID,
    UPLOADS_IMAGES: process.env.GOOGLE_DRIVE_UPLOADS_IMAGES_FOLDER_ID,
    UPLOADS_REVIEWS: process.env.GOOGLE_DRIVE_UPLOADS_REVIEWS_FOLDER_ID,
    UPLOADS_VIDEOS: process.env.GOOGLE_DRIVE_UPLOADS_VIDEOS_FOLDER_ID,
    UPLOADS_FONTS: process.env.GOOGLE_DRIVE_UPLOADS_FONTS_FOLDER_ID,
    UPLOADS_DOCUMENTS: process.env.GOOGLE_DRIVE_UPLOADS_DOCUMENTS_FOLDER_ID,
    UPLOADS_SALES_AUDIO: process.env.GOOGLE_DRIVE_UPLOADS_SALES_AUDIO_FOLDER_ID,
    UPLOADS_AUDIO: process.env.GOOGLE_DRIVE_UPLOADS_AUDIO_FOLDER_ID,
    CRUISE_IMAGES: process.env.GOOGLE_DRIVE_CRUISE_IMAGES_FOLDER_ID,
    APIS_MAIN: process.env.GOOGLE_DRIVE_APIS_MAIN_FOLDER_ID,
    APIS_TEMPLATE_ID: process.env.GOOGLE_DRIVE_APIS_TEMPLATE_ID,
    ROOT: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
    CASHFLOW: process.env.GOOGLE_DRIVE_CASHFLOW_FOLDER_ID,
    TOTALCASH: process.env.GOOGLE_DRIVE_TOTALCASH_FOLDER_ID,
    BACKUP_LOGS: process.env.GOOGLE_DRIVE_BACKUP_LOGS_FOLDER_ID,
};

export async function getDriveFolderId(key: DriveConfigKey): Promise<string> {
    try {
        // 1. Check SystemConfig (DB)
        const configKey = DRIVE_CONFIG_KEYS[key];
        const config = await prisma.systemConfig.findUnique({
            where: { configKey },
            select: { configValue: true },
        });

        if (config?.configValue) {
            console.log(`[DriveConfig] ${key} from DB: ${config.configValue}`);
            return config.configValue;
        }

        // 2. Check Environment Variable (ENV_MAPPING already contains the value)
        const envValue = ENV_MAPPING[key];
        if (envValue) {
            console.log(`[DriveConfig] ${key} from ENV: ${envValue}`);
            return envValue;
        }

        // 3. Return Default
        console.log(`[DriveConfig] ${key} from DEFAULT: ${DEFAULTS[key]}`);
        return DEFAULTS[key];
    } catch (error) {
        console.error(`[DriveConfig] Error fetching config for ${key}:`, error);
        // Fallback to env or default even on DB error
        return ENV_MAPPING[key] || DEFAULTS[key];
    }
}

export async function getAllDriveConfigs() {
    const configs = await prisma.systemConfig.findMany({
        where: {
            configKey: {
                in: Object.values(DRIVE_CONFIG_KEYS),
            },
        },
    });

    const result = {} as Record<DriveConfigKey, { value: string; source: 'DB' | 'ENV' | 'DEFAULT' }>;

    for (const key of Object.keys(DRIVE_CONFIG_KEYS) as DriveConfigKey[]) {
        const dbConfig = configs.find((c) => c.configKey === DRIVE_CONFIG_KEYS[key]);

        if (dbConfig?.configValue) {
            result[key] = { value: dbConfig.configValue, source: 'DB' };
        } else if (ENV_MAPPING[key]) {
            // ENV_MAPPING[key]는 이미 환경변수 값이므로 직접 사용
            result[key] = { value: ENV_MAPPING[key]!, source: 'ENV' };
        } else {
            result[key] = { value: DEFAULTS[key], source: 'DEFAULT' };
        }
    }

    return result;
}
