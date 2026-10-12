'use client';

import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';

const LoginPage = dynamic(() => import('./LoginPage'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>
  ),
});

export default function Page() {
  return (
    <>
      <LoginPage />
      <Toaster position="bottom-right" />
    </>
  );
}
