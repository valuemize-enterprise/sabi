'use client';
/**
 * /portal/page.tsx — Client Invoice Portal
 * Read-only view of a brand's invoices. No staff auth needed — uses portal JWT.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, CheckCircle2, Clock, AlertTriangle, Minus, ExternalLink } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const ptok = () => typeof window !== 'undefined' ? localStorage.getItem('portal_token') : null;

async function portalFetch(path: string) {
  const res  = await fetch(`${API}/api/client-portal${path}`, {
    headers: { Authorization: `Bearer ${ptok()}` }, cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('SESSION_EXPIRED');
  if (!res.ok) throw new Error(body?.error || 'Request failed');
  return body;
}

interface PortalInvoice {
  id: string; invoice_number: string; type: string; status: string;
  total_amount: number; amount_paid: number; issued_date: string;
  due_date: string; client_note: string | null;
}

interface Brand { name: string; primary_color: string | null; logo_url: string | null }

const naira   = (n: number) => `₦${Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'});
const daysLeft = (d: string) => Math.ceil((new Date(d).getTime()-Date.now())/(1000*60*60*24));

const STATUS_CFG: Record<string,[string,React.ReactNode]> = {
  sent:    ['#DBEAFE text-blue-700',   <Clock      style={{width:12,height:12}} />],
  viewed:  ['#EDE9FE text-purple-700', <Clock      style={{width:12,height:12}} />],
  partial: ['#FEF3C7 text-amber-700',  <AlertTriangle style={{width:12,height:12}} />],
  paid:    ['#D1FAE5 text-green-700',  <CheckCircle2 style={{width:12,height:12}} />],
  overdue: ['#FEE2E2 text-red-700',    <AlertTriangle style={{width:12,height:12}} />],
  draft:   ['#F3F4F6 text-gray-500',   <Minus      style={{width:12,height:12}} />],
};

export default function ClientPortalPage() {
  const router    = useRouter();
  const [brand,   setBrand]   = useState<Brand|null>(null);
  const [email,   setEmail]   = useState('');
  const [invoices,setInvoices]= useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected,setSelected]= useState<PortalInvoice|null>(null);
  const [detail,  setDetail]  = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [bRes, iRes] = await Promise.all([portalFetch('/brand'), portalFetch('/invoices')]);
      setBrand(bRes.brand); setEmail(bRes.email);
      setInvoices(iRes.invoices || []);
    } catch(e:any) {
      if (e.message === 'SESSION_EXPIRED') { localStorage.removeItem('portal_token'); router.replace('/portal/login?expired=1'); }
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    if (!ptok()) { router.replace('/portal/login'); return; }
    load();
  }, [load, router]);

  const openDetail = async (inv: PortalInvoice) => {
    setSelected(inv); setDetail(null);
    try { const res = await portalFetch(`/invoices/${inv.id}`); setDetail(res.invoice); } catch {}
  };

  const downloadPDF = async (invId: string, invNum: string) => {
    const res = await fetch(`${API}/api/client-portal/invoices/${invId}/pdf`, { headers:{ Authorization:`Bearer ${ptok()}` } });
    const blob = await res.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${invNum}.pdf`; a.click();
  };

  const totalOutstanding = invoices
    .filter(i => !['paid','cancelled'].includes(i.status))
    .reduce((s,i) => s + Number(i.total_amount) - Number(i.amount_paid), 0);

  const accentColor = brand?.primary_color || '#5B21B6';

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#F0F2F8',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:40,height:40,border:`3px solid ${accentColor}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#F0F2F8',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${accentColor},${accentColor}CC)`,padding:'20px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {brand?.logo_url && <img src={brand.logo_url} alt={brand?.name} style={{width:36,height:36,borderRadius:8,objectFit:'cover',border:'2px solid rgba(255,255,255,0.3)'}}/>}
          <div>
            <p style={{fontSize:18,fontWeight:700,color:'#fff'}}>{brand?.name || 'Invoice Portal'}</p>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.7)'}}>Invoice portal · {email}</p>
          </div>
        </div>
        <div style={{background:'rgba(255,255,255,0.15)',borderRadius:10,padding:'10px 16px',textAlign:'right'}}>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.7)'}}>Outstanding balance</p>
          <p style={{fontSize:20,fontWeight:800,color:'#fff'}}>{naira(totalOutstanding)}</p>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'24px 16px'}}>

        {/* Invoice detail slide-over */}
        {selected && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:50,display:'flex',alignItems:'flex-start',justifyContent:'flex-end'}} onClick={()=>{setSelected(null);setDetail(null);}}>
            <div style={{width:'100%',maxWidth:480,height:'100vh',background:'#fff',overflowY:'auto',padding:24}} onClick={e=>e.stopPropagation()}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <div>
                  <p style={{fontSize:16,fontWeight:700,color:'#111827'}}>{selected.invoice_number}</p>
                  <p style={{fontSize:12,color:'#6B7280',marginTop:2,textTransform:'capitalize'}}>{selected.type} invoice</p>
                </div>
                <button onClick={()=>downloadPDF(selected.id,selected.invoice_number)}
                  style={{display:'flex',alignItems:'center',gap:6,background:accentColor,color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',fontSize:13,cursor:'pointer'}}>
                  <Download style={{width:14,height:14}}/> Download PDF
                </button>
              </div>

              <div style={{background:'#F9FAFB',borderRadius:10,padding:16,marginBottom:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[
                  ['Invoice date', fmtDate(selected.issued_date)],
                  ['Due date',     fmtDate(selected.due_date)],
                  ['Status',       selected.status.toUpperCase()],
                  ['Amount',       naira(selected.total_amount)],
                ].map(([l,v])=>(
                  <div key={l}><p style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{l}</p>
                  <p style={{fontSize:13,fontWeight:600,color:'#111827'}}>{v}</p></div>
                ))}
              </div>

              {detail && (
                <>
                  <p style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Line items</p>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,marginBottom:16}}>
                    <thead><tr style={{background:'#F9FAFB'}}>
                      {['Description','Qty','Unit','Amount'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 10px',fontSize:10,color:'#9CA3AF',textTransform:'uppercase',borderBottom:'1px solid #E5E7EB'}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {detail.line_items?.map((li:any,i:number)=>(
                        <tr key={i} style={{borderBottom:'1px solid #F3F4F6'}}>
                          <td style={{padding:'9px 10px',color:'#374151'}}>{li.description}</td>
                          <td style={{padding:'9px 10px',color:'#6B7280'}}>{li.quantity}</td>
                          <td style={{padding:'9px 10px',color:'#6B7280'}}>{naira(li.unit_price)}</td>
                          <td style={{padding:'9px 10px',fontWeight:600,color:'#111827',textAlign:'right'}}>{naira(li.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{background:'#F9FAFB',borderRadius:8,padding:12}}>
                    {[['Subtotal',naira(detail.subtotal),'#374151'],detail.vat_amount>0?[`VAT (${(Number(detail.vat_rate)*100).toFixed(1)}%)`,naira(detail.vat_amount),'#374151']:null,['Total',naira(detail.total_amount),'#111827'],detail.amount_paid>0?['Paid',naira(detail.amount_paid),'#059669']:null].filter(Boolean).map(([l,v,c]:any)=>(
                      <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:13}}>
                        <span style={{color:'#6B7280'}}>{l}</span>
                        <span style={{fontWeight:600,color:c}}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {detail.payments?.length > 0 && (
                    <>
                      <p style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',margin:'16px 0 10px'}}>Payment history</p>
                      {detail.payments.map((p:any,i:number)=>(
                        <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #F3F4F6',fontSize:13}}>
                          <div><p style={{color:'#111827',fontWeight:500}}>{naira(p.amount)}</p><p style={{color:'#9CA3AF',fontSize:11}}>{p.payment_method?.replace(/_/g,' ')} {p.reference?`· Ref: ${p.reference}`:''}</p></div>
                          <p style={{color:'#6B7280',fontSize:12}}>{fmtDate(p.payment_date)}</p>
                        </div>
                      ))}
                    </>
                  )}

                  {detail.client_note && (
                    <div style={{marginTop:16,background:'#EDE9FE',borderLeft:`3px solid ${accentColor}`,padding:'10px 14px',borderRadius:'0 8px 8px 0'}}>
                      <p style={{fontSize:12,color:'#374151',lineHeight:1.6}}>{detail.client_note}</p>
                    </div>
                  )}
                </>
              )}

              <button onClick={()=>{setSelected(null);setDetail(null);}} style={{marginTop:20,width:'100%',padding:'10px',border:'1px solid #E5E7EB',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13,color:'#6B7280'}}>Close</button>
            </div>
          </div>
        )}

        {/* Invoice list */}
        <div style={{background:'#fff',borderRadius:14,border:'0.5px solid #E5E7EB',overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <p style={{fontSize:15,fontWeight:600,color:'#111827'}}>Your invoices</p>
              <p style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>{invoices.length} invoice{invoices.length!==1?'s':''} in total</p>
            </div>
          </div>

          {invoices.length===0 ? (
            <div style={{padding:'48px 20px',textAlign:'center'}}>
              <FileText style={{width:40,height:40,margin:'0 auto 12px',color:'#E5E7EB'}}/>
              <p style={{fontSize:14,color:'#9CA3AF'}}>No invoices yet</p>
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
              <thead><tr style={{background:'#F9FAFB'}}>
                {['Invoice','Date','Due','Amount','Status',''].map(h=><th key={h} style={{textAlign:'left',padding:'10px 16px',fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'1px solid #F3F4F6'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {invoices.map(inv => {
                  const dl = daysLeft(inv.due_date);
                  const effectiveStatus = !['paid','cancelled'].includes(inv.status) && dl<0 ? 'overdue' : inv.status;
                  const [badgeStyle, badgeIcon] = STATUS_CFG[effectiveStatus] || STATUS_CFG.draft;
                  const [bg, fg] = badgeStyle.split(' ');
                  return (
                    <tr key={inv.id} style={{borderBottom:'1px solid #F9FAFB',cursor:'pointer',transition:'background 0.1s'}}
                      onMouseEnter={e=>(e.currentTarget.style.background='#FAFBFF')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                      onClick={()=>openDetail(inv)}>
                      <td style={{padding:'12px 16px'}}>
                        <p style={{fontWeight:600,color:'#111827'}}>{inv.invoice_number}</p>
                        <p style={{fontSize:11,color:'#9CA3AF',textTransform:'capitalize',marginTop:2}}>{inv.type}</p>
                      </td>
                      <td style={{padding:'12px 16px',color:'#6B7280',fontSize:12}}>{fmtDate(inv.issued_date)}</td>
                      <td style={{padding:'12px 16px',fontSize:12}}>
                        <p style={{color:'#6B7280'}}>{fmtDate(inv.due_date)}</p>
                        {!['paid','cancelled'].includes(inv.status) && dl>0 && <p style={{color:'#D97706',fontSize:10}}>{dl}d remaining</p>}
                        {effectiveStatus==='overdue' && <p style={{color:'#DC2626',fontSize:10}}>{Math.abs(dl)}d overdue</p>}
                      </td>
                      <td style={{padding:'12px 16px',fontWeight:700,color:'#111827'}}>{naira(inv.total_amount)}</td>
                      <td style={{padding:'12px 16px'}}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:20,background:bg?.replace('bg-',''),color:fg?.replace('text-','')}}>
                          {badgeIcon} {effectiveStatus.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td style={{padding:'12px 16px'}}>
                        <button onClick={e=>{e.stopPropagation();downloadPDF(inv.id,inv.invoice_number);}}
                          style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:accentColor,background:'transparent',border:`1px solid ${accentColor}33`,borderRadius:6,padding:'4px 10px',cursor:'pointer'}}>
                          <Download style={{width:11,height:11}}/> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{textAlign:'center',padding:'20px',fontSize:12,color:'#9CA3AF'}}>
          Powered by <a href="https://cerebre.media" style={{color:accentColor}}>Cerebre Media Africa</a> · Sabi Intelligence Suite
        </div>
      </div>
    </div>
  );
}
