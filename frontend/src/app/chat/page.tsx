'use client';

import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';

const ChatInterface = dynamic(() => import('@/components/chat/ChatInterface'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>
  ),
});

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950">
      <ChatInterface />
      <Toaster position="bottom-right" />
    </div>
  );
}
