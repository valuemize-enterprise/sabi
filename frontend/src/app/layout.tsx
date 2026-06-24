import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title:       'Sabi Intelligence Suite',
  description: 'AI-powered marketing intelligence platform by Cerebre Media Africa',
  icons:       { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0d0d1a" />
      </head>
      <body className="bg-[#0d0d1a] text-white antialiased">{children}</body>
    </html>
  );
}
