import { Suspense } from 'react';
import { ChatBotPageContent } from '../../page';

interface ShareChatBotPageProps {
  params: Promise<{ token: string }>;
}

export default async function ShareChatBotPage({ params }: ShareChatBotPageProps) {
  const { token } = await params;
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">로딩 중...</div>}>
      <ChatBotPageContent shareToken={token} />
    </Suspense>
  );
}
