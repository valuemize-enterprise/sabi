'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PenLine, Target, FileText, CheckSquare } from 'lucide-react';

const NAV = [
  { href:'tasks',     label:'My Tasks',    icon:CheckSquare, desc:'Tasks assigned to me' },
  { href:'work',      label:'Log Work',    icon:PenLine,     desc:'Log my contributions' },
  { href:'goals',     label:'Goals',       icon:Target,      desc:'Brand KPIs'           },
  { href:'reports',   label:'Reports',     icon:FileText,    desc:'Published reports'    },
];

export default function MyBrandDetailPage() {
  const { id: brandId } = useParams<{ id: string }>();
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/my-brands" className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit"><ArrowLeft className="w-3.5 h-3.5"/>My Brands</Link>
      <h1 className="text-xl font-bold text-white mb-7">Brand Overview</h1>
      <div className="grid grid-cols-2 gap-4">
        {NAV.map(({href,label,icon:Icon,desc})=>(
          <Link key={href} href={`/brands/${brandId}/${href}`}
            className="sabi-card p-5 hover:border-purple-500/20 transition-all group text-center">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-500/20 transition-all"><Icon className="w-5 h-5 text-purple-400"/></div>
            <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">{label}</p>
            <p className="text-xs text-white/30 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
