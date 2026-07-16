'use client';
import { Bell, Check, CheckCheck, AlertCircle, Info, Trophy, FileText, Target } from 'lucide-react';
import { useState } from 'react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { PageHeader, Badge } from '@/components/ui';

const MOCK_NOTIFS = [
  { id:'1', type:'success', title:'ClarityScore™ Updated',      body:'FiberOne Nigeria jumped from 682 to 782. Grade improved from B → A.',      time:'2 min ago',  read:false },
  { id:'2', type:'info',    title:'New Report Published',       body:'Q2 Brand Performance Report for Zenith Bank has been published to clients.',time:'1 hr ago',   read:false },
  { id:'3', type:'warning', title:'Goal At Risk',               body:'Instagram Follower Growth goal for Dangote is at 23% with 14 days left.',   time:'3 hrs ago',  read:false },
  { id:'4', type:'success', title:'Task Completed',             body:'Campaign Creative Review marked as done by Tunde Adewale.',               time:'Yesterday',   read:true  },
  { id:'5', type:'info',    title:'Client Login',               body:'Amaka Obi (Flutterwave) logged into the client portal.',                  time:'Yesterday',   read:true  },
  { id:'6', type:'success', title:'AudienceIQ™ Profile Ready', body:'Lagos Young Professional profile generated for Zenith Bank.',              time:'2 days ago',  read:true  },
];

const NOTIF_ICONS: Record<string,any> = { success: Trophy, warning: AlertCircle, info: Info };
const NOTIF_COLORS: Record<string,string> = { success:'text-green-400 bg-green-500/10', warning:'text-amber-400 bg-amber-500/10', info:'text-blue-400 bg-blue-500/10' };

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFS);
  const unread = notifs.filter(n=>!n.read).length;

  const markRead = (id: string) => setNotifs(p=>p.map(n=>n.id===id?{...n,read:true}:n));
  const markAllRead = () => setNotifs(p=>p.map(n=>({...n,read:true})));

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <AgencyTopNav title="Notifications"/>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          {unread>0&&<p className="text-sm text-white/40 mt-1">{unread} unread notification{unread!==1?'s':''}</p>}
        </div>
        {unread>0&&<button onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"><CheckCheck className="w-3.5 h-3.5"/>Mark all read</button>}
      </div>

      <div className="space-y-2">
        {notifs.map(n=>{
          const Icon = NOTIF_ICONS[n.type]||Info;
          return (
            <div key={n.id} onClick={()=>markRead(n.id)}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${n.read?'border-white/5 bg-transparent hover:bg-white/2':'border-white/8 bg-white/3 hover:bg-white/5'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${NOTIF_COLORS[n.type]}`}>
                <Icon className="w-4 h-4"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${n.read?'text-white/60':'text-white'}`}>{n.title}</p>
                <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-xs text-white/20 mt-2">{n.time}</p>
              </div>
              {!n.read&&<div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-2"/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
