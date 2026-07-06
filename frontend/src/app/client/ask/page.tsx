'use client';
import { useState, useRef, useEffect } from 'react';
import { Brain, Send, Plus, Sparkles, Loader2, User, ChevronRight } from 'lucide-react';
import { clientPortal } from '@/lib/api';
import { useClientStore } from '@/lib/store';

const STARTERS = [
  'How is our brand performing this month?',
  'What is our current ClarityScore™ and what does it mean?',
  'Which of our goals are at risk?',
  'What should we focus on for Q3?',
  'Summarize our latest performance report',
  'What marketing moments should we plan for next month?',
];

interface Message { role: 'user' | 'aria'; content: string; ts: string; }

export default function ClientAskPage() {
  const { client } = useClientStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', content: msg, ts: new Date().toISOString() }]);
    setSending(true);
    try {
      const res: any = await clientPortal.askAria.send(msg, sessionId ?? undefined);
      setSessionId(res.data?.session_id ?? null);
      setMessages(p => [...p, { role: 'aria', content: res.data?.response ?? 'No response', ts: new Date().toISOString() }]);
    } catch {
      setMessages(p => [...p, { role: 'aria', content: 'ARIA is temporarily unavailable. Please try again in a moment.', ts: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0d0d1a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-white/5 bg-[#0a0a18] flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center">
          <Brain className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Ask ARIA</p>
          <p className="text-xs text-white/30">AI Intelligence Assistant for {client?.brand?.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl w-full mx-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-10">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center" style={{ animation: 'pulseGlow 2s ease-in-out infinite' }}>
              <Brain className="w-7 h-7 text-purple-400" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-white mb-1">ARIA is ready</h2>
              <p className="text-sm text-white/40 max-w-sm">Ask anything about your brand performance, goals, reports, or market strategy.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-md">
              {STARTERS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-left px-4 py-3 rounded-xl bg-white/3 border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-sm text-white/60 hover:text-white flex items-center gap-2 group">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="flex-1">{s}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-purple-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 mb-5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === 'aria' ? 'bg-purple-500/30' : 'bg-blue-500/30'}`}>
              {m.role === 'aria' ? <Brain className="w-4 h-4 text-purple-400" /> : <User className="w-4 h-4 text-blue-400" />}
            </div>
            <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role === 'aria' ? 'bg-white/5 border border-white/8 text-white/80 rounded-tl-sm' : 'bg-purple-600/30 border border-purple-500/30 text-white rounded-tr-sm'}`}>
              {m.content}
              <p className="text-[10px] text-white/20 mt-1.5">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center"><Brain className="w-4 h-4 text-purple-400" /></div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/5 border border-white/8">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-[#0a0a18] flex-shrink-0">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask ARIA about your brand…" rows={1}
            className="sabi-input flex-1 resize-none text-sm py-3"
            style={{ minHeight: 44, maxHeight: 120 }} />
          <button onClick={() => send()} disabled={!input.trim() || sending}
            className="sabi-btn-primary w-11 h-11 flex-shrink-0 flex items-center justify-center p-0 rounded-xl disabled:opacity-40">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-white/15 mt-2">ARIA has context about your brand, goals, and reports. Powered by Anthropic Claude.</p>
      </div>
    </div>
  );
}
