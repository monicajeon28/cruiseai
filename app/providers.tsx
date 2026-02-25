'use client';

import { ReactNode } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import AccessCheckWrapper from '@/components/AccessCheckWrapper';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import SecurityProtection from '@/components/SecurityProtection';
import QueryProvider from "@/components/providers/QueryProvider";

export default function Providers({ children }: { children: ReactNode }) {
  const { toasts, removeToast } = useToast();

  return (
    <QueryProvider>
      <ErrorBoundary>
        <SecurityProtection />
        <AccessCheckWrapper>
          {children}
        </AccessCheckWrapper>
        <AnalyticsTracker />
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </ErrorBoundary>
    </QueryProvider>
  );
}
