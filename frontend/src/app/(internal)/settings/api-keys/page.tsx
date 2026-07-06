'use client';
import { useState } from 'react';
import { Key, Eye, EyeOff, Plus, Trash2, Copy, Check } from 'lucide-react';
import { PageHeader, Badge } from '@/components/ui';
import { AgencyTopNav } from '@/components/internal/TopNav';

const MOCK_KEYS = [
  { id:'1', name:'Production API Key', prefix:'sk-sabi-prod-****', created:'2026-01-15', last_used:'2 hrs ago',  scope:'read_write' },
  { id:'2', name:'Analytics Read Key',  prefix:'sk-sabi-anly-****', created:'2026-03-01', last_used:'Never',      scope:'read_only'  },
];

export default function ApiKeysPage() {
  const [keys, setKeys]   = useState(MOCK_KEYS);
  const [show, setShow]   = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(()=>setCopied(''),2000);
  };

  const generate = () => {
    if (!newName.trim()) return;
    setKeys(p=>[...p,{id:Date.now().toString(),name:newName,prefix:'sk-sabi-new-****',created:new Date().toISOString().split('T')[0],last_used:'Never',scope:'read_only'}]);
    setNewName(''); setShowNew(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <AgencyTopNav title="Settings"/>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center"><Key className="w-5 h-5 text-amber-400"/></div>
        <div><h1 className="text-xl font-bold text-white">API Keys</h1><p className="text-sm text-white/40">Manage API access credentials</p></div>
      </div>
      <div className="flex justify-end mb-4">
        <button onClick={()=>setShowNew(true)} className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Plus className="w-4 h-4"/>Generate Key</button>
      </div>
      {showNew&&(
        <div className="sabi-card p-5 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">New API Key</h3>
          <div className="flex gap-3">
            <input className="sabi-input flex-1 text-sm" placeholder="Key name e.g. Reporting Dashboard" value={newName} onChange={e=>setNewName(e.target.value)}/>
            <button onClick={generate} className="sabi-btn-primary px-4 py-2 text-sm">Generate</button>
            <button onClick={()=>setShowNew(false)} className="px-3 py-2 text-sm text-white/30 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-4">
        {keys.map(k=>(
          <div key={k.id} className="sabi-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div><p className="font-medium text-white">{k.name}</p><p className="text-xs text-white/30 mt-0.5">Created: {k.created} · Last used: {k.last_used}</p></div>
              <div className="flex items-center gap-2">
                <Badge label={k.scope.replace('_',' ')} color={k.scope==='read_write'?'amber':'blue'}/>
                <button onClick={()=>setKeys(p=>p.filter(key=>key.id!==k.id))} className="text-white/20 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/3 rounded-lg p-3 font-mono text-sm">
              <span className="flex-1 text-white/60">{show.has(k.id)?'sk-sabi-full-key-would-show-here':k.prefix}</span>
              <button onClick={()=>setShow(p=>{const n=new Set(p);n.has(k.id)?n.delete(k.id):n.add(k.id);return n;})} className="text-white/30 hover:text-white transition-colors">
                {show.has(k.id)?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
              </button>
              <button onClick={()=>copy(k.prefix,k.id)} className="text-white/30 hover:text-white transition-colors">
                {copied===k.id?<Check className="w-4 h-4 text-green-400"/>:<Copy className="w-4 h-4"/>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
