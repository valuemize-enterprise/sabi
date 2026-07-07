'use client';
import { Toaster } from 'react-hot-toast';

export function ToasterProvider() {
  return <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />;
}
