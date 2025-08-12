import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AccessibilityProvider, SkipLink } from '@/components/ui/accessibility';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VoiceFlow Pro - Advanced Audio Transcription',
  description: 'AI-powered audio transcription with privacy-focused local processing options',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AccessibilityProvider>
          <SkipLink href="#main-content" />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </AccessibilityProvider>
      </body>
    </html>
  );
}