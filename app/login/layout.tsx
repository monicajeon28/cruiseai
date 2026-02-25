export default function LoginLayout({ children }: { children: React.ReactNode }) {
  // 로그인 페이지는 하단 네비게이션 바와 패딩 없이 표시
  return (
    <div className="min-h-screen" style={{ paddingBottom: 0 }}>
      {children}
    </div>
  );
}

















