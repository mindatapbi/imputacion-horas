"use client";

import { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import AppHeader from "@/components/AppHeader";

interface Entry {
  worklogId: string; issueKey: string; issueSummary: string; issueType: string;
  project: string; projectKey: string;
  parentKey: string | null; parentSummary: string | null;
  date: string; hours: number; minutes: number;
  timeSpentSeconds: number; comment: string;
}
interface EpicGroup { parentKey: string | null; parentSummary: string | null; issues: IssueRow[]; totalSeconds: number; }
interface IssueRow { issueKey: string; issueSummary: string; issueType: string; project: string; totalSeconds: number; byDate: Record<string, Entry[]>; }
interface NewEntry { issueKey: string; issueSummary: string; date: string; }
interface Project { key: string; name: string; }
interface Issue { key: string; summary: string; status: string; project: string; issueType: string; parentKey: string | null; parentSummary: string | null; }
interface IssueGroup { parentKey: string | null; parentSummary: string | null; issues: Issue[]; }

const JORNADA_HORAS = 8;
const ISSUE_TYPE_STYLES: Record<string, { emoji: string; color: string }> = {
  "Epic": { emoji: "⚡", color: "#7C3AED" }, "Story": { emoji: "📗", color: "#059669" },
  "Task": { emoji: "✅", color: "#2563EB" }, "Sub-task": { emoji: "↳", color: "#9CA3AF" }, "Bug": { emoji: "🐛", color: "#DC2626" },
};

// ── PARSE HORAS EN FORMATO LIBRE ──────────────────────────────────────────────
function parseHours(val: string): number | null {
  const v = val.trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) return parseFloat(v);
  const hm1 = v.match(/^(\d+):(\d+)$/);
  if (hm1) return parseInt(hm1[1]) + parseInt(hm1[2]) / 60;
  const hm2 = v.match(/^(\d+)h(\d+)m?$/i);
  if (hm2) return parseInt(hm2[1]) + parseInt(hm2[2]) / 60;
  const hOnly = v.match(/^(\d+)h$/i);
  if (hOnly) return parseInt(hOnly[1]);
  const mOnly = v.match(/^(\d+)m$/i);
  if (mOnly) return parseInt(mOnly[1]) / 60;
  return null;
}

function fmtTime(s: number) { if (!s) return ""; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return m ? (h ? `${h}h ${m}m` : `${m}m`) : `${h}h`; }
function fmtDate(d: string) { return new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"}); }
function getDays(from: string, to: string) { const days: string[]=[]; const c=new Date(from+"T12:00:00"), e=new Date(to+"T12:00:00"); while(c<=e){days.push(c.toISOString().split("T")[0]);c.setDate(c.getDate()+1);} return days; }

function groupIssuesForPanel(issues: Issue[]): IssueGroup[] {
  const g: Record<string,IssueGroup>={};
  for(const i of issues){const k=i.parentKey||"__none__";if(!g[k])g[k]={parentKey:i.parentKey,parentSummary:i.parentSummary,issues:[]};g[k].issues.push(i);}
  return Object.values(g).sort((a,b)=>a.parentKey===null?1:b.parentKey===null?-1:(a.parentKey||"").localeCompare(b.parentKey||""));
}

function buildEpicGroups(entries: Entry[]): EpicGroup[] {
  const epicMap: Record<string, EpicGroup> = {};
  for (const entry of entries) {
    const epicKey = entry.parentKey || "__none__";
    if (!epicMap[epicKey]) epicMap[epicKey] = { parentKey: entry.parentKey, parentSummary: entry.parentSummary, issues: [], totalSeconds: 0 };
    const epic = epicMap[epicKey];
    epic.totalSeconds += entry.timeSpentSeconds;
    let issueRow = epic.issues.find(i => i.issueKey === entry.issueKey);
    if (!issueRow) { issueRow = { issueKey: entry.issueKey, issueSummary: entry.issueSummary, issueType: entry.issueType, project: entry.project, totalSeconds: 0, byDate: {} }; epic.issues.push(issueRow); }
    if (!issueRow.byDate[entry.date]) issueRow.byDate[entry.date] = [];
    issueRow.byDate[entry.date].push(entry);
    issueRow.totalSeconds += entry.timeSpentSeconds;
  }
  return Object.values(epicMap).sort((a, b) => a.parentKey === null ? 1 : b.parentKey === null ? -1 : (a.parentKey||"").localeCompare(b.parentKey||""));
}

function ProjectSelector({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (k: string) => void }) {
  const [search, setSearch] = useState(""); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  const selected = projects.find(p=>p.key===value);
  const filtered = projects.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.key.toLowerCase().includes(search.toLowerCase()));
  useEffect(()=>{const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  return (
    <div ref={ref} style={{position:'relative'}}>
      <button onClick={()=>setOpen(!open)} style={{width:'100%',border:'1px solid #DCDEE0',borderRadius:3,padding:'6px 10px',fontSize:12,textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff',cursor:'pointer'}}>
        {selected?<span style={{color:'#1C1C1C',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selected.name} <span style={{color:'#E30613',fontFamily:'monospace',fontWeight:700}}>({selected.key})</span></span>:<span style={{color:'#9CA3AF'}}>— Elegí un proyecto —</span>}
        <span style={{color:'#9CA3AF',fontSize:10,flexShrink:0,marginLeft:4}}>{open?'▲':'▼'}</span>
      </button>
      {open&&<div style={{position:'absolute',zIndex:20,width:'100%',marginTop:2,background:'#fff',border:'1px solid #DCDEE0',borderRadius:3,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',overflow:'hidden'}}>
        <div style={{padding:6,borderBottom:'1px solid #DCDEE0'}}><input autoFocus type="text" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:'100%',border:'1px solid #DCDEE0',borderRadius:3,padding:'5px 8px',fontSize:11,outline:'none'}}/></div>
        <div style={{maxHeight:180,overflowY:'auto'}}>{filtered.length===0?<p style={{padding:'10px',fontSize:11,color:'#9CA3AF',textAlign:'center',margin:0}}>Sin resultados</p>:filtered.map(p=><button key={p.key} onClick={()=>{onChange(p.key);setOpen(false);setSearch("");}} style={{width:'100%',textAlign:'left',padding:'7px 10px',fontSize:11,background:value===p.key?'#FBEEEE':'transparent',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{color:'#1C1C1C',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</span><span style={{color:'#E30613',fontFamily:'monospace',fontSize:10,fontWeight:700,flexShrink:0,marginLeft:4}}>{p.key}</span></button>)}</div>
      </div>}
    </div>
  );
}

function PanelEpicGroup({ group, onAdd }: { group: IssueGroup; onAdd: (i: Issue) => void }) {
  const [collapsed, setCollapsed] = useState(true);
  const isEpic = !!group.parentKey;
  return (
    <div style={{marginBottom:6}}>
      <button onClick={()=>setCollapsed(!collapsed)} style={{width:'100%',display:'flex',alignItems:'center',gap:6,padding:'5px 6px',borderRadius:3,background:isEpic?'#FBEEEE':'#F9FAFB',border:`1px solid ${isEpic?'rgba(212,175,55,0.3)':'#DCDEE0'}`,cursor:'pointer',textAlign:'left'}}>
        <span style={{fontSize:10,color:'#9CA3AF',transform:collapsed?'rotate(-90deg)':'none',display:'inline-block',transition:'transform 0.12s'}}>▼</span>
        {isEpic?<><span style={{fontSize:11}}>⚡</span><span style={{fontSize:11,fontWeight:700,color:'#1C1C1C',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{group.parentSummary}</span><span style={{fontSize:10,color:'#E30613',fontFamily:'monospace',fontWeight:700,flexShrink:0}}>{group.parentKey}</span></>:<span style={{fontSize:11,fontWeight:700,color:'#9CA3AF',flex:1}}>Sin épica</span>}
        <span style={{fontSize:10,padding:'1px 5px',borderRadius:99,background:isEpic?'#FBEEEE':'#F3F4F6',color:isEpic?'#E30613':'#6B6B6B',flexShrink:0}}>{group.issues.length}</span>
      </button>
      {!collapsed&&<div style={{marginLeft:8,marginTop:3,paddingLeft:10,borderLeft:`2px solid ${isEpic?'rgba(212,175,55,0.4)':'#DCDEE0'}`}}>
        {group.issues.map(issue=>(
          <div key={issue.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 8px',marginBottom:3,borderRadius:3,border:'1px solid #DCDEE0',background:'#fff',gap:8}}>
            <div style={{minWidth:0,flex:1}}><p style={{margin:0,fontSize:11,fontWeight:600,color:'#1C1C1C',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{issue.summary}</p><span style={{fontSize:10,fontFamily:'monospace',fontWeight:700,color:'#E30613'}}>{issue.key}</span></div>
            <button onClick={()=>onAdd(issue)} style={{flexShrink:0,fontSize:10,border:'1px solid #DCDEE0',borderRadius:3,padding:'2px 7px',background:'#fff',color:'#E30613',cursor:'pointer',fontWeight:700,whiteSpace:'nowrap'}}>+ Agregar</button>
          </div>
        ))}
      </div>}
    </div>
  );
}

function EntryModal({ title, issueKey, issueSummary, date, initialHours=0, initialMinutes=0, initialComment="", worklogId, onSave, onClose }: {
  title: string; issueKey: string; issueSummary: string; date: string;
  initialHours?: number; initialMinutes?: number; initialComment?: string; worklogId?: string;
  onSave: (e: Entry) => void; onClose: () => void;
}) {
  const [timeRaw, setTimeRaw] = useState(() => {
    if (initialHours === 0 && initialMinutes === 0) return "";
    if (initialMinutes === 0) return `${initialHours}h`;
    if (initialHours === 0) return `${initialMinutes}m`;
    return `${initialHours}h ${initialMinutes}m`;
  });
  const [timeError, setTimeError] = useState(false);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleTimeChange = (val: string) => {
    setTimeRaw(val);
    const parsed = parseHours(val);
    setTimeError(val !== "" && (parsed === null || parsed <= 0));
  };

  const handleSave = async () => {
    const parsed = parseHours(timeRaw);
    if (!parsed || parsed <= 0) { setError("Formato no válido. Usá: 2h30, 90m, 1:30, 2.5"); return; }
    const hours = Math.floor(parsed);
    const minutes = Math.round((parsed - hours) * 60);
    setSaving(true); setError("");
    if (worklogId) {
      const res = await fetch("/api/jira/timesheet",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({issueKey,worklogId,hours,minutes,comment,date})});
      if(res.ok)onSave({worklogId,issueKey,issueSummary,issueType:"Task",project:"",projectKey:"",parentKey:null,parentSummary:null,date,hours,minutes,timeSpentSeconds:hours*3600+minutes*60,comment});
      else setError("No se pudo guardar.");
    } else {
      const res = await fetch("/api/jira/worklog",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entries:[{issueKey,hours,minutes,comment,date}]})});
      const data = await res.json();
      if(data.errors?.length>0)setError("No se pudo registrar.");
      else onSave({worklogId:`temp-${Date.now()}`,issueKey,issueSummary,issueType:"Task",project:"",projectKey:"",parentKey:null,parentSummary:null,date,hours,minutes,timeSpentSeconds:hours*3600+minutes*60,comment});
    }
    setSaving(false);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:16}}>
      <div style={{background:'#fff',borderRadius:4,boxShadow:'0 8px 32px rgba(0,0,0,0.2)',width:'100%',maxWidth:420,padding:24,borderTop:'3px solid #D4AF37'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
          <div><h3 style={{fontSize:15,fontWeight:700,color:'#1C1C1C',margin:0}}>{title}</h3><p style={{fontSize:11,color:'#E30613',fontFamily:'monospace',fontWeight:700,margin:'3px 0 0'}}>{issueKey} · {fmtDate(date)}</p><p style={{fontSize:12,color:'#6B6B6B',margin:'2px 0 0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:300}}>{issueSummary}</p></div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:18,padding:'0 0 0 12px'}}>✕</button>
        </div>
        <div style={{marginBottom:14}}>
          <p style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#6B6B6B',margin:'0 0 6px'}}>Tiempo</p>
          <input
            autoFocus
            type="text"
            value={timeRaw}
            onChange={e => handleTimeChange(e.target.value)}
            placeholder="Ej: 2h30, 90m, 1:30, 2.5"
            style={{width:'100%',border:`1px solid ${timeError?'#E30613':'#DCDEE0'}`,borderRadius:3,padding:'10px 12px',fontSize:15,fontWeight:700,outline:'none',color:timeError?'#E30613':'#1C1C1C',background:timeError?'#FBEEEE':'#F9FAFB'}}
          />
          {timeError && <p style={{fontSize:11,color:'#E30613',margin:'4px 0 0'}}>Formato no válido. Usá: 2h30, 90m, 1:30 o 2.5</p>}
          <p style={{fontSize:10,color:'#9CA3AF',margin:'4px 0 0'}}>Aceptamos: 2 · 2.5 · 2:30 · 2h30 · 2h30m · 90m</p>
        </div>
        <div style={{marginBottom:14}}>
          <p style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#6B6B6B',margin:'0 0 6px'}}>Comentario</p>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} style={{width:'100%',border:'1px solid #DCDEE0',borderRadius:3,padding:'8px 10px',fontSize:12,outline:'none',resize:'none'}} placeholder="Comentario (opcional)"/>
        </div>
        {error&&<p style={{fontSize:12,color:'#E30613',margin:'0 0 12px'}}>{error}</p>}
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,border:'1px solid #DCDEE0',borderRadius:3,padding:'10px',fontSize:13,fontWeight:700,background:'#fff',cursor:'pointer',color:'#333'}}>Cancelar</button>
          <button onClick={handleSave} disabled={saving||timeError} style={{flex:1,background:'#E30613',color:'#fff',border:'none',borderRadius:3,padding:'10px',fontSize:13,fontWeight:700,cursor:'pointer',opacity:(saving||timeError)?0.7:1}}>{saving?'Guardando...':worklogId?'Guardar cambios':'Registrar horas'}</button>
        </div>
      </div>
    </div>
  );
}

export default function TimesheetPage() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const today = fmt(now);

  const [from, setFrom] = useState(fmt(firstOfMonth));
  const [to, setTo] = useState(fmt(lastOfMonth));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{displayName:string;email:string;avatarUrl:string}|null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry|null>(null);
  const [newEntry, setNewEntry] = useState<NewEntry|null>(null);
  const [deletingId, setDeletingId] = useState<string|null>(null);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [quickDate, setQuickDate] = useState(today);
  const [collapsedEpics, setCollapsedEpics] = useState<Record<string, boolean>>({});

  useEffect(()=>{fetchUser();fetchProjects();},[]);
  useEffect(()=>{if(from&&to&&from<=to)fetchTimesheet();},[from,to]);
  useEffect(()=>{if(selectedProject)fetchIssues(selectedProject);else setIssues([]);setIssueSearch("");},[selectedProject]);

  const fetchUser=async()=>{const r=await fetch("/api/auth/me");if(r.ok){const d=await r.json();setUser(d.user);}};
  const fetchProjects=async()=>{setLoadingProjects(true);const r=await fetch("/api/jira/issues");if(r.ok){const d=await r.json();setProjects(d.projects||[]);}setLoadingProjects(false);};
  const fetchIssues=async(pk:string)=>{setLoadingIssues(true);const r=await fetch(`/api/jira/issues?project=${pk}`);if(r.ok){const d=await r.json();setIssues(d.issues||[]);}setLoadingIssues(false);};
  const fetchTimesheet=async()=>{setLoading(true);setError("");const r=await fetch(`/api/jira/timesheet?from=${from}&to=${to}`);if(r.status===401){window.location.href="/";return;}if(r.ok){const d=await r.json();setEntries(d.entries||[]);}else setError("Error al cargar el timesheet.");setLoading(false);};
  const handleSaveEdit=(updated:Entry)=>{setEntries(prev=>prev.map(e=>e.worklogId===updated.worklogId?updated:e));setEditingEntry(null);};
  const handleSaveNew=(_:Entry)=>{setNewEntry(null);fetchTimesheet();};
  const handleDelete=async(entry:Entry)=>{if(!confirm(`¿Eliminar ${fmtTime(entry.timeSpentSeconds)} de ${entry.issueKey}?`))return;setDeletingId(entry.worklogId);const r=await fetch("/api/jira/timesheet",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({issueKey:entry.issueKey,worklogId:entry.worklogId})});if(r.ok)setEntries(prev=>prev.filter(e=>e.worklogId!==entry.worklogId));else setError("No se pudo eliminar.");setDeletingId(null);};
  const toggleEpic=(key:string)=>setCollapsedEpics(prev=>({...prev,[key]:!prev[key]}));

  const exportToExcel=()=>{
    if(!entries.length)return;
    const days=getDays(from,to);
    const rowMap:Record<string,{key:string;summary:string;project:string;epic:string;totalSeconds:number;byDate:Record<string,number>}>={};
    for(const e of entries){if(!rowMap[e.issueKey])rowMap[e.issueKey]={key:e.issueKey,summary:e.issueSummary,project:e.project,epic:e.parentSummary||"Sin épica",totalSeconds:0,byDate:{}};rowMap[e.issueKey].byDate[e.date]=(rowMap[e.issueKey].byDate[e.date]||0)+e.timeSpentSeconds;rowMap[e.issueKey].totalSeconds+=e.timeSpentSeconds;}
    const rows=Object.values(rowMap).sort((a,b)=>a.epic.localeCompare(b.epic)||a.key.localeCompare(b.key));
    const dt:Record<string,number>={};for(const e of entries)dt[e.date]=(dt[e.date]||0)+e.timeSpentSeconds;
    const gt=entries.reduce((acc,e)=>acc+e.timeSpentSeconds,0);
    const ws=XLSX.utils.aoa_to_sheet([['Épica','Clave','Incidencia','Proyecto','Total',...days.map(d=>fmtDate(d))],...rows.map(r=>[r.epic,r.key,r.summary,r.project,fmtTime(r.totalSeconds),...days.map(d=>{const s=r.byDate[d]||0;return s?fmtTime(s):'';})]),['','','','TOTAL',fmtTime(gt),...days.map(d=>{const s=dt[d]||0;return s?fmtTime(s):'';})],]);
    ws['!cols']=[{wch:30},{wch:12},{wch:40},{wch:20},{wch:10},...days.map(()=>({wch:10}))];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Timesheet');XLSX.writeFile(wb,`timesheet_${from}_${to}.xlsx`);
  };

  const shiftWeek=(dir:number)=>{const f=new Date(from+"T12:00:00");f.setDate(f.getDate()+dir*7);const t=new Date(to+"T12:00:00");t.setDate(t.getDate()+dir*7);setFrom(fmt(f));setTo(fmt(t));};
  const goThisWeek=()=>{const m=new Date(now);m.setDate(now.getDate()-((now.getDay()+6)%7));const s=new Date(m);s.setDate(m.getDate()+6);setFrom(fmt(m));setTo(fmt(s));};
  const goThisMonth=()=>{setFrom(fmt(firstOfMonth));setTo(fmt(lastOfMonth));};

  const days=getDays(from,to);
  const epicGroups=buildEpicGroups(entries);
  const dt:Record<string,number>={};for(const e of entries)dt[e.date]=(dt[e.date]||0)+e.timeSpentSeconds;
  const gt=entries.reduce((acc,e)=>acc+e.timeSpentSeconds,0);
  const isWE=(d:string)=>{const dow=new Date(d+"T12:00:00").getDay();return dow===0||dow===6;};
  const filteredIssues=issues.filter(i=>i.summary.toLowerCase().includes(issueSearch.toLowerCase())||i.key.toLowerCase().includes(issueSearch.toLowerCase()));
  const panelGroups=groupIssuesForPanel(filteredIssues);

  return (
    <main style={{minHeight:'100vh',background:'#ECF0F1',fontFamily:'Arial, sans-serif'}}>
      <AppHeader user={user} activeTab="timesheet" />

      <div style={{display:'flex',height:'calc(100vh - 57px)'}}>
        {/* PANEL IZQUIERDO */}
        <div style={{width:280,flexShrink:0,background:'#fff',borderRight:'1px solid #DCDEE0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'10px 12px',borderBottom:'1px solid rgba(212,175,55,0.3)',background:'#FAFAFA'}}>
            <h2 style={{fontSize:13,fontWeight:700,color:'#1C1C1C',margin:0}}>Agregar horas</h2>
            <p style={{fontSize:11,color:'#6B6B6B',margin:'2px 0 0'}}>Elegí proyecto, ticket y fecha</p>
          </div>
          <div style={{padding:'8px 10px',borderBottom:'1px solid #DCDEE0'}}>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#6B6B6B',margin:'0 0 5px'}}>Fecha</p>
            <input type="date" value={quickDate} onChange={e=>setQuickDate(e.target.value)} style={{width:'100%',border:'1px solid #DCDEE0',borderRadius:3,padding:'6px 8px',fontSize:12,color:'#1C1C1C',outline:'none'}}/>
          </div>
          <div style={{padding:'8px 10px',borderBottom:'1px solid #DCDEE0'}}>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#6B6B6B',margin:'0 0 5px'}}>Proyecto</p>
            {loadingProjects?<div style={{fontSize:11,color:'#6B6B6B'}}>Cargando...</div>:<ProjectSelector projects={projects} value={selectedProject} onChange={setSelectedProject}/>}
          </div>
          {selectedProject&&<div style={{padding:'6px 10px',borderBottom:'1px solid #DCDEE0'}}>
            <input type="text" placeholder="🔍 Filtrar tickets..." value={issueSearch} onChange={e=>setIssueSearch(e.target.value)} style={{width:'100%',border:'1px solid #DCDEE0',borderRadius:3,padding:'5px 8px',fontSize:11,outline:'none'}}/>
          </div>}
          <div style={{flex:1,overflowY:'auto',padding:10}}>
            {loadingIssues?<div style={{textAlign:'center',padding:'20px 0',fontSize:12,color:'#6B6B6B'}}>Cargando...</div>
            :!selectedProject?<div style={{textAlign:'center',padding:'24px 0'}}><div style={{fontSize:28,marginBottom:6}}>📁</div><p style={{fontSize:12,color:'#9CA3AF',margin:0}}>Elegí un proyecto</p></div>
            :filteredIssues.length===0?<p style={{fontSize:11,color:'#9CA3AF',textAlign:'center',padding:'16px 0'}}>Sin tickets activos</p>
            :panelGroups.map(g=><PanelEpicGroup key={g.parentKey||"__none__"} group={g} onAdd={i=>setNewEntry({issueKey:i.key,issueSummary:i.summary,date:quickDate})}/>)}
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div style={{flex:1,overflow:'auto',padding:16}}>
          <div style={{background:'#fff',border:'1px solid #DCDEE0',borderRadius:3,padding:'10px 14px',display:'flex',flexWrap:'wrap',alignItems:'center',gap:10,justifyContent:'space-between',marginBottom:14,boxShadow:'0 1px 0 rgba(28,28,28,0.04)'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>shiftWeek(-1)} style={{width:28,height:28,border:'1px solid #DCDEE0',borderRadius:3,background:'#F9FAFB',cursor:'pointer',fontSize:12}}>◀</button>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{border:'1px solid #DCDEE0',borderRadius:3,padding:'5px 8px',fontSize:12,color:'#1C1C1C',outline:'none'}}/>
                <span style={{color:'#9CA3AF',fontSize:12}}>→</span>
                <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{border:'1px solid #DCDEE0',borderRadius:3,padding:'5px 8px',fontSize:12,color:'#1C1C1C',outline:'none'}}/>
              </div>
              <button onClick={()=>shiftWeek(1)} style={{width:28,height:28,border:'1px solid #DCDEE0',borderRadius:3,background:'#F9FAFB',cursor:'pointer',fontSize:12}}>▶</button>
              <button onClick={goThisWeek} style={{fontSize:11,padding:'5px 10px',border:'1px solid #E30613',borderRadius:3,color:'#E30613',background:'#fff',cursor:'pointer',fontWeight:700}}>Esta semana</button>
              <button onClick={goThisMonth} style={{fontSize:11,padding:'5px 10px',border:'1px solid #DCDEE0',borderRadius:3,color:'#6B6B6B',background:'#fff',cursor:'pointer'}}>Este mes</button>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              {!loading&&entries.length>0&&<span style={{fontSize:12,color:'#6B6B6B'}}>Total: <strong style={{color:'#1C1C1C'}}>{fmtTime(gt)}</strong></span>}
              <button onClick={exportToExcel} disabled={!entries.length||loading} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,color:'#1F7A44',border:'1px solid #1F7A44',borderRadius:3,padding:'5px 10px',background:'#fff',cursor:'pointer',opacity:(!entries.length||loading)?0.4:1}}>
                ⬇ Exportar Excel
              </button>
            </div>
          </div>

          {error&&<div style={{background:'#FBEEEE',borderLeft:'3px solid #E30613',padding:'8px 12px',fontSize:12,marginBottom:12,color:'#8E0000',borderRadius:3}}>{error}</div>}

          {loading?(
            <div style={{background:'#fff',border:'1px solid #DCDEE0',borderRadius:3,padding:40,display:'flex',alignItems:'center',justifyContent:'center',gap:10,color:'#6B6B6B',fontSize:13}}>
              Cargando registros...
            </div>
          ):(
            <div style={{background:'#fff',border:'1px solid #DCDEE0',borderRadius:3,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:600}}>
                  <thead>
                    <tr style={{background:'#1C1C1C'}}>
                      <th style={{textAlign:'left',padding:'8px 12px',fontSize:10,fontWeight:700,color:'#fff',textTransform:'uppercase',letterSpacing:'0.1em',minWidth:240,borderRight:'1px solid rgba(212,175,55,0.3)',position:'sticky',left:0,background:'#1C1C1C',zIndex:10}}>Incidencia</th>
                      <th style={{textAlign:'right',padding:'8px 10px',fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.6)',textTransform:'uppercase',minWidth:70}}>Total</th>
                      {days.map(d=>(
                        <th key={d} style={{textAlign:'center',padding:'6px 4px',minWidth:42,background:'#1C1C1C',borderBottom:d===today?'2px solid #E30613':'none'}}>
                          <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',color:d===today?'#E30613':isWE(d)?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.5)'}}>{new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short"})}</div>
                          <div style={{fontSize:12,fontWeight:700,color:d===today?'#E30613':isWE(d)?'rgba(255,255,255,0.2)':'#fff'}}>{new Date(d+"T12:00:00").getDate()}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {epicGroups.length===0?(
                      <tr><td colSpan={days.length+2} style={{textAlign:'center',padding:40,color:'#9CA3AF',fontSize:13}}>No hay registros en este período</td></tr>
                    ):epicGroups.map(epic=>{
                      const epicKey=epic.parentKey||"__none__";
                      const isCollapsed=collapsedEpics[epicKey]??false;
                      const isEpic=!!epic.parentKey;
                      return (
                        <>
                          <tr key={`epic-${epicKey}`} style={{background:'#F5F5F0',cursor:'pointer',borderBottom:'1px solid #DCDEE0'}} onClick={()=>toggleEpic(epicKey)}>
                            <td style={{padding:'7px 12px',position:'sticky',left:0,background:'#F5F5F0',borderRight:'1px solid rgba(212,175,55,0.3)',zIndex:5}}>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span style={{fontSize:10,color:'#9CA3AF',transform:isCollapsed?'rotate(-90deg)':'none',display:'inline-block',transition:'transform 0.12s'}}>▼</span>
                                {isEpic?<><span style={{fontSize:13}}>⚡</span><span style={{fontSize:12,fontWeight:700,color:'#1C1C1C',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{epic.parentSummary}</span><span style={{fontSize:10,color:'#E30613',fontFamily:'monospace',fontWeight:700,flexShrink:0,marginLeft:4}}>{epic.parentKey}</span></>:<span style={{fontSize:12,fontWeight:700,color:'#9CA3AF'}}>Sin épica</span>}
                                <span style={{fontSize:10,color:'#9CA3AF',marginLeft:4}}>({epic.issues.length} ticket{epic.issues.length>1?'s':''})</span>
                              </div>
                            </td>
                            <td style={{textAlign:'right',padding:'7px 10px'}}><span style={{fontSize:11,fontWeight:700,color:'#6B6B6B'}}>{fmtTime(epic.totalSeconds)}</span></td>
                            {days.map(d=>{const secs=epic.issues.reduce((acc,i)=>{const de=i.byDate[d]||[];return acc+de.reduce((a,e)=>a+e.timeSpentSeconds,0);},0);return <td key={d} style={{textAlign:'center',padding:'7px 4px',background:isWE(d)?'#F0F0EC':'#F5F5F0'}}>{secs>0?<span style={{fontSize:10,color:'#6B6B6B'}}>{fmtTime(secs)}</span>:<span style={{color:'#DCDEE0',fontSize:10}}>—</span>}</td>;})}
                          </tr>
                          {!isCollapsed&&epic.issues.map((row,ri)=>{
                            const ts=ISSUE_TYPE_STYLES[row.issueType]||{emoji:"📄",color:"#9CA3AF"};
                            return (
                              <tr key={row.issueKey} style={{borderBottom:'1px solid #F0F0F0',background:ri%2===0?'#fff':'#FAFAFA'}}>
                                <td style={{padding:'8px 12px 8px 24px',position:'sticky',left:0,background:ri%2===0?'#fff':'#FAFAFA',borderRight:'1px solid rgba(212,175,55,0.2)',zIndex:5}}>
                                  <div style={{display:'flex',alignItems:'flex-start',gap:6}}>
                                    <span style={{fontSize:13,marginTop:1,color:ts.color}}>{ts.emoji}</span>
                                    <div style={{minWidth:0}}><p style={{margin:0,fontSize:12,fontWeight:600,color:'#1C1C1C',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:200}}>{row.issueSummary}</p><div style={{display:'flex',gap:6,marginTop:2}}><span style={{fontSize:10,fontFamily:'monospace',fontWeight:700,color:'#E30613'}}>{row.issueKey}</span><span style={{fontSize:10,color:'#9CA3AF'}}>· {row.project}</span></div></div>
                                  </div>
                                </td>
                                <td style={{textAlign:'right',padding:'8px 10px'}}><span style={{fontSize:12,fontWeight:700,color:'#1C1C1C'}}>{fmtTime(row.totalSeconds)}</span></td>
                                {days.map(d=>{
                                  const de=row.byDate[d]||[];const ds=de.reduce((a,e)=>a+e.timeSpentSeconds,0);const we=isWE(d);
                                  return (
                                    <td key={d} style={{textAlign:'center',padding:'6px 4px',background:we?'#F5F5F5':d===today?'#FFF9F0':''}}>
                                      {de.length>0?(
                                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                                          <span style={{fontSize:12,fontWeight:700,color:'#1C1C1C'}}>{fmtTime(ds)}</span>
                                          <div style={{display:'flex',gap:2}}>
                                            {de.map(e=>(
                                              <div key={e.worklogId} style={{display:'flex',gap:2}}>
                                                <button onClick={()=>setEditingEntry(e)} title="Editar" style={{background:'none',border:'none',cursor:'pointer',color:'#DCDEE0',fontSize:12,padding:'0 1px'}} onMouseOver={e2=>(e2.currentTarget.style.color='#E30613')} onMouseOut={e2=>(e2.currentTarget.style.color='#DCDEE0')}>✎</button>
                                                <button onClick={()=>handleDelete(e)} disabled={deletingId===e.worklogId} title="Eliminar" style={{background:'none',border:'none',cursor:'pointer',color:'#DCDEE0',fontSize:12,padding:'0 1px'}} onMouseOver={e2=>(e2.currentTarget.style.color='#E30613')} onMouseOut={e2=>(e2.currentTarget.style.color='#DCDEE0')}>✕</button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ):!we?(
                                        <button onClick={()=>setNewEntry({issueKey:row.issueKey,issueSummary:row.issueSummary,date:d})} style={{width:'100%',height:32,border:'none',background:'transparent',cursor:'pointer',color:'transparent',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}} onMouseOver={e=>{e.currentTarget.style.color='#E30613';e.currentTarget.style.background='#FBEEEE';}} onMouseOut={e=>{e.currentTarget.style.color='transparent';e.currentTarget.style.background='transparent';}} title={`Agregar horas en ${fmtDate(d)}`}>+</button>
                                      ):<span style={{color:'#E8E8E8',fontSize:10}}>—</span>}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'#1C1C1C',borderTop:'2px solid rgba(212,175,55,0.4)'}}>
                      <td style={{padding:'8px 12px',position:'sticky',left:0,background:'#1C1C1C',zIndex:5,borderRight:'1px solid rgba(212,175,55,0.3)'}}><span style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.6)',textTransform:'uppercase',letterSpacing:'0.1em'}}>Total</span></td>
                      <td style={{textAlign:'right',padding:'8px 10px'}}><span style={{fontSize:12,fontWeight:700,color:'#fff'}}>{fmtTime(gt)}</span></td>
                      {days.map(d=>{const s=dt[d]||0;const ic=s>=JORNADA_HORAS*3600;const over=s>JORNADA_HORAS*3600;return <td key={d} style={{textAlign:'center',padding:'8px 4px',background:'#1C1C1C',opacity:isWE(d)?0.3:1}}>{s>0?<span style={{fontSize:11,fontWeight:700,color:over?'#EF4444':ic?'#10B981':'#F59E0B'}}>{over?'⚠ ':''}{fmtTime(s)}</span>:<span style={{color:'rgba(255,255,255,0.2)',fontSize:10}}>—</span>}</td>;})}
                    </tr>
                  </tfoot>
                </table>
              </div>
              {epicGroups.length>0&&<div style={{padding:'8px 12px',borderTop:'1px solid rgba(212,175,55,0.2)',display:'flex',gap:14,background:'#FAFAFA',flexWrap:'wrap'}}>
                <span style={{fontSize:10,color:'#1F7A44',fontWeight:700}}>8h Día completo</span>
                <span style={{fontSize:10,color:'#92400E',fontWeight:700}}>5h Día parcial</span>
                <span style={{fontSize:10,color:'#EF4444',fontWeight:700}}>⚠ Más de 8h</span>
                <span style={{fontSize:10,color:'#9CA3AF'}}>· Click en épica para colapsar · Hover en celda vacía para agregar</span>
              </div>}
            </div>
          )}
        </div>
      </div>

      {editingEntry&&<EntryModal title="Editar registro" issueKey={editingEntry.issueKey} issueSummary={editingEntry.issueSummary} date={editingEntry.date} initialHours={editingEntry.hours} initialMinutes={editingEntry.minutes} initialComment={editingEntry.comment} worklogId={editingEntry.worklogId} onSave={handleSaveEdit} onClose={()=>setEditingEntry(null)}/>}
      {newEntry&&<EntryModal title="Nuevo registro" issueKey={newEntry.issueKey} issueSummary={newEntry.issueSummary} date={newEntry.date} onSave={handleSaveNew} onClose={()=>setNewEntry(null)}/>}
    </main>
  );
}