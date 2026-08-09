'use client';
/**
 * /portal/login/page.tsx — Client Portal Magic Link Handler
 * Exchanges the token from the URL, stores the portal JWT, redirects to /portal
 */

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function PortalLoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'#F0F2F8', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
        <div style={{ background:'#fff', borderRadius:16, padding:48, textAlign:'center', maxWidth:400, width:'100%' }}>
          <Loader2 style={{ width:40, height:40, margin:'0 auto 20px', color:'#5B21B6', animation:'spin 1s linear infinite' }}/>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <PortalLoginContent />
    </Suspense>
  );
}

function PortalLoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token');
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading');
  const [error,  setError]  = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setError('No access token found in the link. Request a new invite from your account manager.'); return; }

    fetch(`${API}/api/client-portal/auth?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Authentication failed');
        localStorage.setItem('portal_token', data.token);
        localStorage.setItem('portal_brand_id', data.brand_id);
        localStorage.setItem('portal_email', data.email);
        setStatus('success');
        setTimeout(() => router.replace('/portal'), 1200);
      })
      .catch(err => { setStatus('error'); setError(err.message); });
  }, [token, router]);

  return (
    <div style={{ minHeight:'100vh', background:'#F0F2F8', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:48, textAlign:'center', maxWidth:400, width:'100%', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
        {status==='loading' && <>
          <Loader2 style={{ width:40, height:40, margin:'0 auto 20px', color:'#5B21B6', animation:'spin 1s linear infinite' }}/>
          <p style={{ fontSize:16, fontWeight:600, color:'#111827', marginBottom:8 }}>Verifying your link…</p>
          <p style={{ fontSize:13, color:'#6B7280' }}>Please wait while we log you in securely.</p>
        </>}
        {status==='success' && <>
          <CheckCircle2 style={{ width:48, height:48, margin:'0 auto 20px', color:'#059669' }}/>
          <p style={{ fontSize:16, fontWeight:600, color:'#111827', marginBottom:8 }}>Access granted</p>
          <p style={{ fontSize:13, color:'#6B7280' }}>Taking you to your invoice portal…</p>
        </>}
        {status==='error' && <>
          <AlertTriangle style={{ width:48, height:48, margin:'0 auto 20px', color:'#DC2626' }}/>
          <p style={{ fontSize:16, fontWeight:600, color:'#111827', marginBottom:8 }}>Access failed</p>
          <p style={{ fontSize:13, color:'#6B7280', lineHeight:1.6 }}>{error}</p>
        </>}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
