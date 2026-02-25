export default function OnboardingLayout({ children }: { children: React.ReactNode; }) {
  // ❌ 여기서 fetch(...)로 /api/... 호출하지 마세요 (SSR에서 절대 URL 문제 발생)
  return <>{children}</>;
}
