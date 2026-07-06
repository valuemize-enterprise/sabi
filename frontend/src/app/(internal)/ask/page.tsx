'use client';

import { useState, useRef, useEffect } from 'react';
import { Brain, Send, Plus, Clock, ChevronRight, Sparkles, Loader2, User, Radio, Menu, X } from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { useAgencyStore } from '@/lib/store';
import { agencyFetch } from '@/lib/api';
import MarkdownIt from 'markdown-it';
import { fromHighlighter } from '@shikijs/markdown-it';
import { createHighlighter } from 'shiki';

interface Message { role: 'user' | 'aria'; content: string; timestamp: string; }

let mdPromise: Promise<MarkdownIt> | null = null;

function getMD(): Promise<MarkdownIt> {
  if (!mdPromise) {
    mdPromise = (async () => {
      const highlighter = await createHighlighter({
        themes: ['dark-plus'],
        langs: ['javascript', 'typescript', 'html', 'css', 'json', 'python', 'bash', 'sql', 'yaml', 'markdown'],
      });
      const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
      md.use(fromHighlighter(highlighter, { theme: 'dark-plus' }));
      return md;
    })();
  }
  return mdPromise;
}

function MarkdownContent({ content }: { content: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    getMD().then(md => setHtml(md.render(content)));
  }, [content]);

  if (html === null) return <>{content}</>;

  return (
    <div
      className="markdown-content prose prose-invert prose-sm max-w-none [&_pre]:bg-[#1a1a2e] [&_pre]:border [&_pre]:border-white/10 [&_pre]:rounded-lg [&_code]:text-purple-300 [&_pre_code]:text-white/90 [&_pre_code]:bg-transparent [&_code]:bg-white/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const STARTERS = [
  "What's our best-performing brand this month?",
  "Give me talking points for a client review meeting",
  "Which of our brands is at risk of missing their goals?",
  "What Nigerian market trends should we be tracking?",
  "Write a client update email for a struggling campaign",
];

export default function AskARIAPage() {
  const { user } = useAgencyStore();
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions]   = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    agencyFetch('/api/agency/ask/sessions').then((r: any) => setSessions(r.data?.sessions ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: msg, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const res: any = await agencyFetch('/api/agency/ask/message', {
        method: 'POST',
        body: JSON.stringify({ message: msg, session_id: sessionId }),
      });
      setSessionId(res.data?.session_id ?? null);
      setMessages(prev => [...prev, { role: 'aria', content: res.data?.response ?? 'No response', timestamp: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'aria', content: 'ARIA is unavailable right now. Check your API key configuration.', timestamp: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  const newChat = () => { setMessages([]); setSessionId(null); };

  return (
    <div className="flex h-screen bg-[#0d0d1a] overflow-hidden relative">
 
      {/* Mobile drawer scrim */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
 
      {/* Sessions panel — fixed column on desktop, slide-in drawer on mobile */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 sm:w-64 flex-shrink-0 flex flex-col bg-[#0a0a18] border-r border-white/5
          transform transition-transform duration-200 ease-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
      >
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <BrandMark />
            <button
              onClick={() => setDrawerOpen(false)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={newChat}
            className="w-full mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-purple-600/20 border border-purple-500/20 text-purple-300 text-sm font-medium hover:bg-purple-600/30 transition-all"
          >
            <Plus className="w-4 h-4" /> New chat
          </button>
        </div>
 
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-3 pt-1 pb-2 text-[10px] font-semibold tracking-wider text-white/25 uppercase">
            Recent
          </p>
          {sessions.map((s) => {
            const active = s.id === sessionId;
            return (
              <button
                key={s.id}
                onClick={() => { setSessionId(s.id); setDrawerOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                  active ? 'bg-purple-600/15 border border-purple-500/25' : 'border border-transparent hover:bg-white/5'
                }`}
              >
                <p className={`text-xs truncate ${active ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>
                  {s.lastMessage || 'Empty session'}
                </p>
                <p className="text-[10px] text-white/20 mt-1 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(s.updated_at).toLocaleDateString()}
                </p>
              </button>
            );
          })}
          {!sessions.length && (
            <p className="text-xs text-white/20 text-center py-6">No previous conversations</p>
          )}
        </div>
      </div>
 
      {/* Main chat column */}
      <div className="flex-1 flex flex-col min-w-0">
 
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0a0a18]/80 backdrop-blur-sm lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/5"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <BrandMark compact />
        </div>
 
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 max-w-lg mx-auto text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center animate-pulse">
                <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Ask ARIA</h2>
                <p className="text-sm text-white/40">
                  Your AI intelligence analyst. Ask anything about your brands, market, or strategy.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left px-4 py-3 rounded-xl bg-white/3 border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-sm text-white/60 hover:text-white group"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      <span className="flex-1">{s}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-purple-400 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
 
          <div className="max-w-3xl mx-auto">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 sm:gap-3 mb-5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  m.role === 'aria' ? 'bg-purple-500/30 text-purple-300' : 'bg-blue-500/30 text-blue-300'
                }`}>
                  {m.role === 'aria' ? <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>
                <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'aria'
                    ? 'bg-white/5 border border-white/8 text-white/80 rounded-tl-sm'
                    : 'bg-purple-600/30 border border-purple-500/30 text-white rounded-tr-sm'
                }`}>
                  {m.role === 'aria' ? <MarkdownContent content={m.content} /> : m.content}
                  <p className="text-[10px] text-white/20 mt-1.5">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
 
            {sending && (
              <div className="flex gap-2.5 sm:gap-3 mb-5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-500/30 flex items-center justify-center flex-shrink-0">
                  <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/5 border border-white/8 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
 
        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-white/5 bg-[#0a0a18]" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-end gap-2 sm:gap-3 max-w-3xl mx-auto">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask ARIA about your brand, strategy, or the market…"
              rows={1}
              className="flex-1 resize-none text-sm py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-purple-500/40 focus:bg-white/8 transition-all"
              style={{ minHeight: 44, maxHeight: 160 }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-purple-600 transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-center text-[10px] text-white/15 mt-2">
            ARIA uses your brand data as context · Powered by Claude
          </p>
        </div>
      </div>
    </div>
  );
}
 
function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
        <Radio className="w-4 h-4 text-purple-400" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#0a0a18]" />
      </div>
      {!compact && (
        <div>
          <p className="text-sm font-bold text-white leading-tight">Ask ARIA</p>
          <p className="text-[10px] text-white/35 leading-tight">AI intelligence analyst</p>
        </div>
      )}
      {compact && <p className="text-sm font-bold text-white">Ask ARIA</p>}
    </div>
  );
}
