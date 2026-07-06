import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets:['latin'], display:'swap' });

export const metadata: Metadata = {
  title:       'Sabi Intelligence Suite',
  description: 'AI-powered marketing intelligence — Cerebre Media Africa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0d0d1a] text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
