'use client';
import { useState } from 'react';
import { Star, Send, CheckCircle2, Loader2 } from 'lucide-react';

const QUESTIONS = [
  { id:'q1', text:'How satisfied are you with the quality of work delivered?', type:'rating' },
  { id:'q2', text:'How would you rate communication and responsiveness from the team?', type:'rating' },
  { id:'q3', text:'How clearly is your brand strategy being executed?', type:'rating' },
  { id:'q4', text:'How likely are you to recommend Cerebre Media Africa to a colleague?', type:'nps' },
  { id:'q5', text:'What can we do better? (Optional)', type:'text' },
];

export default function ClientSatisfactionPage() {
  const [ratings, setRatings] = useState<Record<string,any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r=>setTimeout(r,1500));
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-4"><CheckCircle2 className="w-7 h-7 text-green-400"/></div>
      <h2 className="text-xl font-bold text-white mb-2">Thank you!</h2>
      <p className="text-white/40">Your feedback has been submitted. We genuinely appreciate it and use it to improve every month.</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-7"><h1 className="text-xl font-bold text-white">Satisfaction Survey</h1><p className="text-sm text-white/40 mt-1">Share how we're doing. Takes less than 2 minutes.</p></div>
      <form onSubmit={submit} className="space-y-5">
        {QUESTIONS.map(q=>(
          <div key={q.id} className="sabi-card p-5">
            <p className="text-sm font-medium text-white mb-4">{q.text}</p>
            {q.type==='rating'&&(
              <div className="flex items-center gap-2">
                {[1,2,3,4,5].map(n=>(
                  <button type="button" key={n} onClick={()=>setRatings(p=>({...p,[q.id]:n}))}
                    className={`w-10 h-10 rounded-xl border transition-all ${ratings[q.id]>=n?'bg-purple-600 border-purple-500 text-white':'border-white/10 text-white/30 hover:border-purple-500/40 hover:text-white'}`}>
                    {n}
                  </button>
                ))}
                <span className="text-xs text-white/30 ml-2">{ratings[q.id]?['','Poor','Fair','Good','Great','Excellent'][ratings[q.id]]:''}</span>
              </div>
            )}
            {q.type==='nps'&&(
              <div>
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(11)].map((_,n)=>(
                    <button type="button" key={n} onClick={()=>setRatings(p=>({...p,[q.id]:n}))}
                      className={`w-9 h-9 rounded-lg text-xs border transition-all ${ratings[q.id]===n?'bg-purple-600 border-purple-500 text-white':'border-white/10 text-white/30 hover:border-white/20 hover:text-white'}`}>{n}</button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-white/20"><span>Not likely</span><span>Very likely</span></div>
              </div>
            )}
            {q.type==='text'&&(
              <textarea className="sabi-input resize-none" rows={3} placeholder="Share your thoughts…" value={ratings[q.id]??''} onChange={e=>setRatings(p=>({...p,[q.id]:e.target.value}))}/>
            )}
          </div>
        ))}
        <button type="submit" disabled={submitting} className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3">
          {submitting?<><Loader2 className="w-4 h-4 animate-spin"/>Submitting…</>:<><Send className="w-4 h-4"/>Submit Feedback</>}
        </button>
      </form>
    </div>
  );
}
