"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

interface Entry {
  worklogId: string; issueKey: string; issueSummary: string; issueType: string;
  project: string; projectKey: string; date: string; hours: number; minutes: number;
  timeSpentSeconds: number; comment: string;
}
interface RowIssue { issueKey: string; issueSummary: string; issueType: string; project: string; totalSeconds: number; byDate: Record<string, Entry[]>; }
interface NewEntry { issueKey: string; issueSummary: string; date: string; }
interface Project { key: string; name: string; }
interface Issue { key: string; summary: string; status: string; project: string; issueType: string; parentKey: string | null; parentSummary: string | null; }
interface Group { parentKey: string | null; parentSummary: string | null; issues: Issue[]; }

const JORNADA_HORAS = 8;

const ISSUE_TYPE_STYLES: Record<string, { emoji: string; color: string }> = {
  "Epic": { emoji: "⚡", color: "text-purple-500" }, "Story": { emoji: "📗", color: "text-green-500" },
  "Task": { emoji: "✅", color: "text-blue-500" }, "Sub-task": { emoji: "↳", color: "text-gray-400" }, "Bug": { emoji: "🐛", color: "text-red-500" },
};

function fmtTime(s: number) { if (!s) return ""; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return m ? (h ? `${h}h ${m}m` : `${m}m`) : `${h}h`; }
function fmtDate(d: string) { return new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"}); }
function getDays(from: string, to: string) { const days=[]; const c=new Date(from+"T12:00:00"), e=new Date(to+"T12:00:00"); while(c<=e){days.push(c.toISOString().split("T")[0]);c.setDate(c.getDate()+1);} return days; }
function groupIssues(issues: Issue[]): Group[] {
  const g: Record<string,Group>={};
  for(const i of issues){const k=i.parentKey||"__none__";if(!g[k])g[k]={parentKey:i.parentKey,parentSummary:i.parentSummary,issues:[]};g[k].issues.push(i);}
  return Object.values(g).sort((a,b)=>a.parentKey===null?1:b.parentKey===null?-1:(a.parentKey||"").localeCompare(b.parentKey||""));
}

function ProjectSelector({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (k: string) => void }) {
  const [search, setSearch] = useState(""); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  const selected = projects.find(p=>p.key===value);
  const filtered = projects.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.key.toLowerCase().includes(search.toLowerCase()));
  useEffect(()=>{const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  return (
    <div ref={ref} className="relative">
      <button onClick={()=>setOpen(!open)} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
        {selected?<span className="text-gray-900 truncate">{selected.name} <span className="text-red-600 font-mono font-semibold">({selected.key})</span></span>:<span className="text-gray-400">— Elegí un proyecto —</span>}
        <svg className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ml-1 ${open?"rotate-180":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open&&<div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
        <div className="p-2 border-b border-gray-100"><div className="relative"><svg className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input autoFocus type="text" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"/></div></div>
        <div className="max-h-48 overflow-y-auto">{filtered.length===0?<p className="text-xs text-gray-400 text-center py-3">Sin resultados</p>:filtered.map(p=><button key={p.key} onClick={()=>{onChange(p.key);setOpen(false);setSearch("");}} className={`w-full text-left px-2.5 py-2 text-xs hover:bg-red-50 transition-colors flex items-center justify-between ${value===p.key?"bg-red-50":""}`}><span className="text-gray-900 truncate">{p.name}</span><span className="text-red-600 font-mono text-xs font-semibold ml-1 flex-shrink-0">{p.key}</span></button>)}</div>
      </div>}
    </div>
  );
}

function EpicGroup({ group, onAdd }: { group: Group; onAdd: (i: Issue) => void }) {
  const [collapsed, setCollapsed] = useState(true);
  const isEpic = !!group.parentKey;
  return (
    <div className="mb-1.5">
      <button onClick={()=>setCollapsed(!collapsed)} className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lg transition-colors text-left ${isEpic?"hover:bg-red-50":"hover:bg-gray-50"}`}>
        <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${collapsed?"-rotate-90":""} ${isEpic?"text-red-400":"text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
        {isEpic?<><span className="text-purple-500 text-xs">⚡</span><span className="text-xs font-semibold text-gray-700 truncate flex-1">{group.parentSummary}</span><span className="text-xs text-red-500 font-mono flex-shrink-0">{group.parentKey}</span></>:<span className="text-xs font-semibold text-gray-400 flex-1">Sin épica</span>}
        <span className={`text-xs px-1 py-0.5 rounded-full flex-shrink-0 ${isEpic?"bg-red-100 text-red-600":"bg-gray-100 text-gray-500"}`}>{group.issues.length}</span>
      </button>
      {!collapsed&&<div className="ml-2 mt-0.5 relative"><div className={`absolute left-0 top-0 bottom-1 w-px ${isEpic?"bg-red-200":"bg-gray-200"}`}/><div className="space-y-1 pl-3">
        {group.issues.map(issue=>(
          <div key={issue.key} className="relative">
            <div className={`absolute -left-3 top-1/2 w-2.5 h-px ${isEpic?"bg-red-200":"bg-gray-200"}`}/>
            <div className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:border-red-200 hover:bg-red-50/30 transition-all">
              <div className="min-w-0 flex-1 mr-2"><p className="text-xs font-medium text-gray-900 truncate">{issue.summary}</p><span className="text-xs font-mono font-semibold text-red-500">{issue.key}</span></div>
              <button onClick={()=>onAdd(issue)} className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded-lg text-red-600 hover:bg-red-100 border border-red-200 transition-all whitespace-nowrap">+ Agregar</button>
            </div>
          </div>
        ))}
      </div></div>}
    </div>
  );
}

function EntryModal({ title, issueKey, issueSummary, date, initialHours=0, initialMinutes=0, initialComment="", worklogId, onSave, onClose }: {
  title: string; issueKey: string; issueSummary: string; date: string;
  initialHours?: number; initialMinutes?: number; initialComment?: string; worklogId?: string;
  onSave: (e: Entry) => void; onClose: () => void;
}) {
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (hours===0&&minutes===0){setError("Poné al menos 1 minuto.");return;}
    setSaving(true);setError("");
    if (worklogId) {
      const res = await fetch("/api/jira/timesheet",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({issueKey,worklogId,hours,minutes,comment,date})});
      if(res.ok)onSave({worklogId,issueKey,issueSummary,issueType:"Task",project:"",projectKey:"",date,hours,minutes,timeSpentSeconds:hours*3600+minutes*60,comment});
      else setError("No se pudo guardar.");
    } else {
      const res = await fetch("/api/jira/worklog",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entries:[{issueKey,hours,minutes,comment,date}]})});
      const data = await res.json();
      if(data.errors?.length>0)setError("No se pudo registrar.");
      else onSave({worklogId:`temp-${Date.now()}`,issueKey,issueSummary,issueType:"Task",project:"",projectKey:"",date,hours,minutes,timeSpentSeconds:hours*3600+minutes*60,comment});
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-t-4 border-red-600">
        <div className="flex items-start justify-between mb-4">
          <div><h3 className="font-bold text-gray-900">{title}</h3><p className="text-xs text-red-500 font-mono font-semibold mt-0.5">{issueKey} · {fmtDate(date)}</p><p className="text-sm text-gray-600 mt-0.5 truncate max-w-xs">{issueSummary}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div className="space-y-4">
          <div><label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Tiempo</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50"><input autoFocus type="number" min={0} max={24} value={hours} onChange={e=>setHours(parseInt(e.target.value)||0)} className="w-12 text-center text-lg font-bold text-gray-900 focus:outline-none bg-transparent"/><span className="text-sm text-gray-400 font-medium">h</span></div>
              <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50"><input type="number" min={0} max={59} step={15} value={minutes} onChange={e=>setMinutes(parseInt(e.target.value)||0)} className="w-12 text-center text-lg font-bold text-gray-900 focus:outline-none bg-transparent"/><span className="text-sm text-gray-400 font-medium">min</span></div>
            </div>
          </div>
          <div><label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Comentario</label><textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" placeholder="Comentario (opcional)"/></div>
        </div>
        {error&&<p className="text-sm text-red-500 mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50">{saving?"Guardando...":worklogId?"Guardar cambios":"Registrar horas"}</button>
        </div>
      </div>
    </div>
  );
}

export default function TimesheetPage() {
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate()-((now.getDay()+6)%7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const today = fmt(now);

  const [from, setFrom] = useState(fmt(monday));
  const [to, setTo] = useState(fmt(sunday));
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

  const exportToExcel=()=>{
    if(!entries.length)return;
    const days=getDays(from,to);
    const rowMap:Record<string,RowIssue>={};
    for(const e of entries){if(!rowMap[e.issueKey])rowMap[e.issueKey]={issueKey:e.issueKey,issueSummary:e.issueSummary,issueType:e.issueType,project:e.project,totalSeconds:0,byDate:{}};if(!rowMap[e.issueKey].byDate[e.date])rowMap[e.issueKey].byDate[e.date]=[];rowMap[e.issueKey].byDate[e.date].push(e);rowMap[e.issueKey].totalSeconds+=e.timeSpentSeconds;}
    const rows=Object.values(rowMap).sort((a,b)=>a.issueKey.localeCompare(b.issueKey));
    const dt:Record<string,number>={};for(const e of entries)dt[e.date]=(dt[e.date]||0)+e.timeSpentSeconds;
    const gt=entries.reduce((acc,e)=>acc+e.timeSpentSeconds,0);
    const ws=XLSX.utils.aoa_to_sheet([
      ['Clave','Incidencia','Proyecto','Total',...days.map(d=>fmtDate(d))],
      ...rows.map(r=>[r.issueKey,r.issueSummary,r.project,fmtTime(r.totalSeconds),...days.map(d=>{const s=(r.byDate[d]||[]).reduce((a,e)=>a+e.timeSpentSeconds,0);return s?fmtTime(s):'';})]),
      ['','','TOTAL',fmtTime(gt),...days.map(d=>{const s=dt[d]||0;return s?fmtTime(s):'';})],
    ]);
    ws['!cols']=[{wch:12},{wch:40},{wch:20},{wch:10},...days.map(()=>({wch:10}))];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Timesheet');XLSX.writeFile(wb,`timesheet_${from}_${to}.xlsx`);
  };

  const shiftWeek=(dir:number)=>{const f=new Date(from+"T12:00:00");f.setDate(f.getDate()+dir*7);const t=new Date(to+"T12:00:00");t.setDate(t.getDate()+dir*7);setFrom(fmt(f));setTo(fmt(t));};
  const goThisWeek=()=>{setFrom(fmt(monday));setTo(fmt(sunday));};
  const goThisMonth=()=>{const f=new Date(now.getFullYear(),now.getMonth(),1);const t=new Date(now.getFullYear(),now.getMonth()+1,0);setFrom(fmt(f));setTo(fmt(t));};

  const days=getDays(from,to);
  const rowMap:Record<string,RowIssue>={};
  for(const e of entries){if(!rowMap[e.issueKey])rowMap[e.issueKey]={issueKey:e.issueKey,issueSummary:e.issueSummary,issueType:e.issueType,project:e.project,totalSeconds:0,byDate:{}};if(!rowMap[e.issueKey].byDate[e.date])rowMap[e.issueKey].byDate[e.date]=[];rowMap[e.issueKey].byDate[e.date].push(e);rowMap[e.issueKey].totalSeconds+=e.timeSpentSeconds;}
  const rows=Object.values(rowMap).sort((a,b)=>a.issueKey.localeCompare(b.issueKey));
  const dt:Record<string,number>={};for(const e of entries)dt[e.date]=(dt[e.date]||0)+e.timeSpentSeconds;
  const gt=entries.reduce((acc,e)=>acc+e.timeSpentSeconds,0);
  const isWE=(d:string)=>{const dow=new Date(d+"T12:00:00").getDay();return dow===0||dow===6;};
  const filteredIssues=issues.filter(i=>i.summary.toLowerCase().includes(issueSearch.toLowerCase())||i.key.toLowerCase().includes(issueSearch.toLowerCase()));
  const groups=groupIssues(filteredIssues);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-[#0D0D0D] px-6 py-3 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-sm shadow-red-900">
              <svg style={{width:18,height:18}} className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <span className="font-bold text-white text-sm tracking-wide">Imputación de Horas</span>
          </div>
          <nav className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
            <Link href="/dashboard" className="px-4 py-1.5 text-sm font-medium text-white/60 hover:text-white rounded-lg transition-colors">Dashboard</Link>
            <span className="px-4 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-lg">Timesheet</span>
          </nav>
          {user&&<div className="flex items-center gap-3">
            {user.avatarUrl?<img src={user.avatarUrl} className="w-8 h-8 rounded-full ring-2 ring-white/20" alt={user.displayName}/>:<div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold">{user.displayName.charAt(0)}</div>}
            <div className="hidden sm:block"><p className="text-sm font-medium text-white leading-tight">{user.displayName}</p><p className="text-xs text-white/50 leading-tight">{user.email}</p></div>
            <a href="/api/auth/logout" className="text-xs text-white/40 hover:text-red-400 transition-colors ml-1 border border-white/10 rounded-lg px-2.5 py-1.5">Salir</a>
          </div>}
        </div>
      </header>

      {/* BODY */}
      <div className="flex h-[calc(100vh-57px)]">
        {/* PANEL IZQUIERDO */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-900 text-sm">Agregar horas</h2>
            <p className="text-xs text-gray-400 mt-0.5">Elegí proyecto, ticket y fecha</p>
          </div>
          <div className="px-3 py-2 border-b border-gray-100">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Fecha</label>
            <input type="date" value={quickDate} onChange={e=>setQuickDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"/>
          </div>
          <div className="px-3 py-2 border-b border-gray-100">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Proyecto</label>
            {loadingProjects?<div className="text-xs text-gray-400 py-1">Cargando...</div>:<ProjectSelector projects={projects} value={selectedProject} onChange={setSelectedProject}/>}
          </div>
          {selectedProject&&<div className="px-3 py-2 border-b border-gray-100">
            <div className="relative"><svg className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" placeholder="Filtrar tickets..." value={issueSearch} onChange={e=>setIssueSearch(e.target.value)} className="w-full border border-gray-200 rounded-lg pl-6 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
          </div>}
          <div className="flex-1 overflow-y-auto p-3">
            {loadingIssues?<div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400"><div className="w-3 h-3 border-2 border-gray-200 border-t-red-500 rounded-full animate-spin"/>Cargando...</div>
            :!selectedProject?<div className="text-center py-6"><div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg></div><p className="text-xs text-gray-400">Elegí un proyecto</p></div>
            :filteredIssues.length===0?<p className="text-xs text-gray-400 text-center py-4">Sin tickets activos</p>
            :groups.map(g=><EpicGroup key={g.parentKey||"__none__"} group={g} onAdd={i=>setNewEntry({issueKey:i.key,issueSummary:i.summary,date:quickDate})}/>)}
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="flex-1 overflow-auto">
          <div className="p-5 space-y-4">
            {/* Controles */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={()=>shiftWeek(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-red-200 transition-colors"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></button>
                  <div className="flex items-center gap-2">
                    <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"/>
                    <span className="text-gray-400 text-sm">→</span>
                    <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  </div>
                  <button onClick={()=>shiftWeek(1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-red-200 transition-colors"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button>
                  <button onClick={goThisWeek} className="text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors">Esta semana</button>
                  <button onClick={goThisMonth} className="text-xs font-medium text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors">Este mes</button>
                </div>
                <div className="flex items-center gap-3">
                  {!loading&&entries.length>0&&<span className="text-sm text-gray-400">Total: <span className="font-bold text-gray-900">{fmtTime(gt)}</span></span>}
                  <button onClick={exportToExcel} disabled={!entries.length||loading} className="flex items-center gap-2 text-sm font-medium text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Exportar Excel
                  </button>
                </div>
              </div>
            </div>

            {error&&<div className="p-3 bg-red-50 border border-red-100 rounded-xl"><p className="text-sm text-red-600">{error}</p></div>}

            {/* Tabla */}
            {loading?(
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex items-center justify-center gap-3 text-gray-400">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-red-500 rounded-full animate-spin"/>Cargando registros...
              </div>
            ):(
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-[#0D0D0D] sticky left-0 z-10 min-w-[260px] border-r border-gray-700 text-white">Incidencia</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-[#0D0D0D] min-w-[70px] text-white/60">Total</th>
                        {days.map(d=>(
                          <th key={d} className={`text-center px-2 py-3 min-w-[75px] bg-[#0D0D0D] ${d===today?"border-b-2 border-red-500":""}`}>
                            <div className={`text-xs font-semibold uppercase tracking-wide ${d===today?"text-red-400":isWE(d)?"text-white/20":"text-white/50"}`}>{new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short"})}</div>
                            <div className={`text-sm font-bold mt-0.5 ${d===today?"text-red-400":isWE(d)?"text-white/20":"text-white"}`}>{new Date(d+"T12:00:00").getDate()}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length===0?(
                        <tr><td colSpan={days.length+2} className="text-center py-12 text-gray-400 text-sm">No hay registros en este período</td></tr>
                      ):rows.map((row,ri)=>{
                        const ts=ISSUE_TYPE_STYLES[row.issueType]||{emoji:"📄",color:"text-gray-400"};
                        return (
                          <tr key={row.issueKey} className={`border-b border-gray-50 hover:bg-red-50/20 transition-colors ${ri%2===0?"":"bg-gray-50/30"}`}>
                            <td className="px-4 py-3 sticky left-0 bg-white border-r border-gray-100 z-10">
                              <div className="flex items-start gap-2">
                                <span className={`text-sm mt-0.5 ${ts.color}`}>{ts.emoji}</span>
                                <div className="min-w-0"><p className="font-medium text-gray-900 truncate max-w-[200px]">{row.issueSummary}</p><div className="flex items-center gap-1.5 mt-0.5"><span className="text-xs font-mono font-semibold text-red-500">{row.issueKey}</span><span className="text-xs text-gray-400">· {row.project}</span></div></div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right"><span className="text-sm font-bold text-gray-900">{fmtTime(row.totalSeconds)}</span></td>
                            {days.map(d=>{
                              const de=row.byDate[d]||[];
                              const ds=de.reduce((a,e)=>a+e.timeSpentSeconds,0);
                              const we=isWE(d);
                              return (
                                <td key={d} className={`px-2 py-2 text-center align-middle group ${we?"bg-gray-50/60":d===today?"bg-red-50/30":""}`}>
                                  {de.length>0?(
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-sm font-semibold text-gray-800">{fmtTime(ds)}</span>
                                      <div className="flex items-center gap-0.5">{de.map(e=>(
                                        <div key={e.worklogId} className="flex items-center gap-0.5">
                                          <button onClick={()=>setEditingEntry(e)} title="Editar" className="text-gray-300 hover:text-red-500 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                                          <button onClick={()=>handleDelete(e)} disabled={deletingId===e.worklogId} title="Eliminar" className="text-gray-300 hover:text-red-500 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
                                        </div>
                                      ))}</div>
                                    </div>
                                  ):!we?(
                                    <button onClick={()=>setNewEntry({issueKey:row.issueKey,issueSummary:row.issueSummary,date:d})} className="w-full h-8 flex items-center justify-center text-gray-200 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title={`Agregar horas en ${fmtDate(d)}`}>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                                    </button>
                                  ):<span className="text-gray-200 text-xs">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200">
                        <td className="px-4 py-3 sticky left-0 bg-[#0D0D0D] border-r border-gray-700 z-10"><span className="text-xs font-bold text-white uppercase tracking-wide">Total</span></td>
                        <td className="px-3 py-3 text-right bg-[#0D0D0D]"><span className="text-sm font-bold text-white">{fmtTime(gt)}</span></td>
                        {days.map(d=>{
                          const s=dt[d]||0;const ic=s>=JORNADA_HORAS*3600;
                          return <td key={d} className={`px-2 py-3 text-center bg-[#0D0D0D] ${isWE(d)?"opacity-30":""}`}>{s>0?<span className={`text-sm font-bold ${ic?"text-green-400":"text-orange-400"}`}>{fmtTime(s)}</span>:<span className="text-white/20 text-xs">—</span>}</td>;
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {rows.length>0&&<div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="font-bold text-green-600">8h</span> Día completo</span>
                  <span className="flex items-center gap-1.5"><span className="font-bold text-orange-500">5h</span> Día parcial</span>
                  <span>Hover sobre celda vacía para agregar · Panel izquierdo para tickets nuevos</span>
                </div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingEntry&&<EntryModal title="Editar registro" issueKey={editingEntry.issueKey} issueSummary={editingEntry.issueSummary} date={editingEntry.date} initialHours={editingEntry.hours} initialMinutes={editingEntry.minutes} initialComment={editingEntry.comment} worklogId={editingEntry.worklogId} onSave={handleSaveEdit} onClose={()=>setEditingEntry(null)}/>}
      {newEntry&&<EntryModal title="Nuevo registro" issueKey={newEntry.issueKey} issueSummary={newEntry.issueSummary} date={newEntry.date} onSave={handleSaveNew} onClose={()=>setNewEntry(null)}/>}
    </main>
  );
}