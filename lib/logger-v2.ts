import winston from 'winston';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata(),
  winston.format.json()
);

// Vercel 및 서버리스 환경 감지
// Vercel: 파일 시스템이 읽기 전용이므로 File transport 사용 불가
// AWS Lambda: 마찬가지로 /tmp 외에는 쓰기 불가
const isServerless =
  process.env.VERCEL === '1' ||
  process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

// 환경에 따라 적절한 transport 선택
const transports: winston.transport[] = isServerless
  ? [
      // 서버리스 환경: 콘솔 로그만 사용
      // Vercel/Netlify/AWS Lambda는 stdout/stderr를 자동으로 수집
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ]
  : [
      // 로컬/일반 서버 환경: 파일 시스템 사용 가능
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 30,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 30,
      }),
    ];

// 개발 환경에서는 콘솔 출력 추가 (로컬 환경만)
if (process.env.NODE_ENV !== 'production' && !isServerless) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Winston logger 생성 (예외 처리 포함)
let logger: winston.Logger;

try {
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    levels,
    format,
    transports,
    exitOnError: false,
  });
} catch (error) {
  // Winston 초기화 실패 시 fallback logger 생성
  console.error('Failed to initialize Winston logger:', error);
  logger = winston.createLogger({
    level: 'info',
    levels,
    format: winston.format.simple(),
    transports: [new winston.transports.Console()],
    exitOnError: false,
  });
}

export default logger;
