'use client';
import { useState } from 'react';
import { Bell, Trophy, FileText, Target, Info, AlertCircle, CheckCheck } from 'lucide-react';

const NOTIFS = [
  { id:'1', type:'report',  title:'New Report Available',            body:'Your Q2 Performance Report is ready. Review insights from your account team.',   time:'Just now',   read:false },
  { id:'2', type:'score',   title:'ClarityScore™ Updated',          body:'Your brand score improved by 47 points this week. Grade moved from B to A.',   time:'2 hrs ago',  read:false },
  { id:'3', type:'goal',    title:'Goal Milestone Reached',          body:'Instagram Followers goal hit 80% completion — only 5,000 followers to go!',    time:'Yesterday',  read:false },
  { id:'4', type:'moment',  title:'MomentMap™ Reminder',            body:'Back-to-School season starts in 2 weeks. Has your team prepared content?',      time:'2 days ago', read:true  },
  { id:'5', type:'report',  title:'Monthly Report Published',        body:'June 2026 Brand Performance Report is now visible in your Reports section.',   time:'5 days ago', read:true  },
];

const ICONS: Record<string,any>   = { report:FileText, score:Trophy, goal:Target, moment:Bell };
const COLORS: Record<string,string> = { report:'text-blue-400 bg-blue-500/10', score:'text-purple-400 bg-purple-500/10', goal:'text-green-400 bg-green-500/10', moment:'text-amber-400 bg-amber-500/10' };

export default function ClientNotificationsPage() {
  const [notifs, setNotifs] = useState(NOTIFS);
  const unread = notifs.filter(n=>!n.read).length;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div><h1 className="text-xl font-bold text-white">Notifications</h1>{unread>0&&<p className="text-sm text-white/40 mt-1">{unread} unread</p>}</div>
        {unread>0&&<button onClick={()=>setNotifs(p=>p.map(n=>({...n,read:true})))} className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"><CheckCheck className="w-3.5 h-3.5"/>Mark all read</button>}
      </div>
      <div className="space-y-2">
        {notifs.map(n=>{
          const Icon = ICONS[n.type]||Bell;
          return (
            <div key={n.id} onClick={()=>setNotifs(p=>p.map(x=>x.id===n.id?{...x,read:true}:x))}
              className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${n.read?'border-white/5 hover:bg-white/2':'border-white/8 bg-white/3 hover:bg-white/5'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${COLORS[n.type]}`}><Icon className="w-4 h-4"/></div>
              <div className="flex-1"><p className={`text-sm font-medium ${n.read?'text-white/60':'text-white'}`}>{n.title}</p><p className="text-xs text-white/40 mt-0.5 leading-relaxed">{n.body}</p><p className="text-xs text-white/20 mt-2">{n.time}</p></div>
              {!n.read&&<div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-2"/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
