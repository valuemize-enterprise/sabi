'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAgencyStore } from '@/lib/store';
import { agencyAuth } from '@/lib/api';
import { KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function SetPasswordPage() {
  const router = useRouter();
  const { user, token, setAuth } = useAgencyStore();
  const [current,setCurrent]=useState(''); const [newPw,setNewPw]=useState(''); const [confirm,setConfirm]=useState('');
  const [showPw,setShowPw]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const submit = async(e:React.FormEvent)=>{
    e.preventDefault();
    if(newPw.length<8){setError('Password must be at least 8 characters');return;}
    if(newPw!==confirm){setError('Passwords do not match');return;}
    setLoading(true);setError('');
    try{ await agencyAuth.setPassword(current,newPw); if(token&&user)setAuth(token,{...user,must_reset_password:false}); router.push('/dashboard'); }
    catch(err:any){setError(err.message||'Failed to update password');}
    finally{setLoading(false);}
  };
  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/20 mb-4"><KeyRound className="w-6 h-6 text-amber-400"/></div>
          <h1 className="text-xl font-bold text-white">Set New Password</h1>
          <p className="text-white/35 text-sm mt-1">Required before you can continue</p>
        </div>
        <div className="sabi-card p-7">
          {error&&<div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            {[['current','Temporary Password',current,setCurrent],['newPw','New Password',newPw,setNewPw],['confirm','Confirm Password',confirm,setConfirm]].map(([k,l,v,sv]:any)=>(
              <div key={k}><label className="text-xs text-white/40 mb-1.5 block">{l}</label>
                <div className="relative"><input type={showPw?'text':'password'} className="sabi-input pr-10" value={v} onChange={(e:any)=>sv(e.target.value)} required/>
                  {k==='confirm'&&<button type="button" onClick={()=>setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">{showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>}
                </div>
              </div>
            ))}
            <button type="submit" disabled={loading} className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading?<><Loader2 className="w-4 h-4 animate-spin"/>Updating…</>:'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
