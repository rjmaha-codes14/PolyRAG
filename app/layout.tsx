import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PolyRAG - Multilingual Document Intelligence & AI Assistant',
  description:
    'Accurate multilingual AI assistant and document intelligence chatbot for India’s 22 scheduled languages, English, and world languages with verified page citations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
