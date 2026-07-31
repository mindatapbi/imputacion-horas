"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

interface Project { key: string; name: string; }
interface Issue {
  key: string; summary: string; status: string;
  project: string; issueType: string;
  parentKey: string | null; parentSummary: string | null;
}
interface Entry { issueKey: string; summary: string; hours: number; minutes: number; comment: string; }
interface Group { parentKey: string | null; parentSummary: string | null; issues: Issue[]; }

const JORNADA_HORAS = 8;

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "In Development": { bg: "#EBF5FF", text: "#1E40AF", dot: "#3B82F6" },
  "In Progress":    { bg: "#EBF5FF", text: "#1E40AF", dot: "#3B82F6" },
  "On Hold":        { bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
  "To Do":          { bg: "#F9FAFB", text: "#374151", dot: "#9CA3AF" },
  "Done":           { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
  "Closed":         { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
  "Blocked":        { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444" },
};

const ISSUE_TYPE_STYLES: Record<string, { emoji: string; color: string }> = {
  "Epic":     { emoji: "⚡", color: "#7C3AED" },
  "Story":    { emoji: "📗", color: "#059669" },
  "Task":     { emoji: "✅", color: "#2563EB" },
  "Sub-task": { emoji: "↳",  color: "#9CA3AF" },
  "Bug":      { emoji: "🐛", color: "#DC2626" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: "#F9FAFB", text: "#374151", dot: "#9CA3AF" };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: c.bg, color: c.text }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {status}
    </span>
  );
}

function SessionExpiredBanner() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', padding: 32, maxWidth: 380, width: '100%', textAlign: 'center', borderTop: '3px solid #D4AF37' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FBEEEE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg style={{ width: 24, height: 24, color: '#E30613' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1C', margin: '0 0 8px' }}>Sesión expirada</h3>
        <p style={{ fontSize: 13, color: '#6B6B6B', margin: '0 0 20px' }}>Tu sesión venció. Necesitás volver a iniciar sesión.</p>
        <a href="/api/auth/logout" style={{ display: 'block', background: '#E30613', color: '#fff', fontWeight: 700, padding: '11px', borderRadius: 3, textDecoration: 'none', fontSize: 13 }}>Volver a ingresar</a>
      </div>
    </div>
  );
}

function OnboardingModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', padding: 32, maxWidth: 440, width: '100%', borderTop: '3px solid #D4AF37' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1C', margin: '0 0 4px' }}>¡Bienvenido a Carga de Horas!</h3>
        <p style={{ fontSize: 13, color: '#6B6B6B', margin: '0 0 20px' }}>Así funciona en 3 pasos simples:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {[
            ["1", "Elegí el proyecto", "Buscá y seleccioná el proyecto de Jira en el panel izquierdo."],
            ["2", "Agregá los tickets", "Expandí la épica y hacé click en '+ Agregar' en cada ticket."],
            ["3", "Imputá las horas", "Ingresá horas y minutos y confirmá con el botón de imputar."],
          ].map(([num, title, desc]) => (
            <div key={num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, background: '#E30613', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{num}</div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1C1C1C' }}>{title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B6B6B' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onDismiss} style={{ width: '100%', background: '#E30613', color: '#fff', border: 'none', borderRadius: 3, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ¡Entendido, empezar!
        </button>
      </div>
    </div>
  );
}

function ProjectSelector({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (k: string) => void }) {
  const [search, setSearch] = useState(""); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  const selected = projects.find(p => p.key === value);
  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.key.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', border: '1px solid #DCDEE0', borderRadius: 3, padding: '8px 12px', fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', cursor: 'pointer', transition: 'border-color 0.12s' }}>
        {selected ? <span style={{ color: '#1C1C1C' }}>{selected.name} <span style={{ color: '#E30613', fontFamily: 'monospace', fontWeight: 700 }}>({selected.key})</span></span> : <span style={{ color: '#9CA3AF' }}>— Elegí un proyecto —</span>}
        <svg style={{ width: 14, height: 14, color: '#9CA3AF', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 20, width: '100%', marginTop: 2, background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <div style={{ padding: 8, borderBottom: '1px solid #DCDEE0' }}>
            <input autoFocus type="text" placeholder="Buscar proyecto..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', border: '1px solid #DCDEE0', borderRadius: 3, padding: '6px 10px', fontSize: 12, outline: 'none' }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? <p style={{ padding: '12px 10px', fontSize: 12, color: '#9CA3AF', textAlign: 'center', margin: 0 }}>Sin resultados</p>
              : filtered.map(p => (
                <button key={p.key} onClick={() => { onChange(p.key); setOpen(false); setSearch(""); }}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, background: value === p.key ? '#FBEEEE' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#1C1C1C' }}>{p.name}</span>
                  <span style={{ color: '#E30613', fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{p.key}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EpicGroup({ group, entries, onAdd, onStartTimer }: { group: Group; entries: Entry[]; onAdd: (i: Issue) => void; onStartTimer: (i: Issue) => void }) {
  const [collapsed, setCollapsed] = useState(true);
  const isEpic = !!group.parentKey;
  const addedCount = group.issues.filter(i => entries.some(e => e.issueKey === i.key)).length;
  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => setCollapsed(!collapsed)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 3, background: isEpic ? '#FBEEEE' : '#F9FAFB', border: '1px solid', borderColor: isEpic ? 'rgba(212,175,55,0.3)' : '#DCDEE0', cursor: 'pointer', textAlign: 'left' }}>
        <svg style={{ width: 12, height: 12, color: '#9CA3AF', transform: collapsed ? '-rotate(90deg)' : 'none', flexShrink: 0, transition: 'transform 0.12s', ...(collapsed ? { transform: 'rotate(-90deg)' } : {}) }} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        {isEpic ? (<><span style={{ fontSize: 13 }}>⚡</span><span style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1C', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.parentSummary}</span><span style={{ fontSize: 11, color: '#E30613', fontFamily: 'monospace', fontWeight: 700, flexShrink: 0 }}>{group.parentKey}</span></>)
          : <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', flex: 1 }}>Sin épica</span>}
        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 99, background: addedCount > 0 ? '#FBEEEE' : '#F3F4F6', color: addedCount > 0 ? '#E30613' : '#6B6B6B', flexShrink: 0 }}>
          {addedCount > 0 ? `${addedCount}/` : ""}{group.issues.length}
        </span>
      </button>
      {!collapsed && (
        <div style={{ marginLeft: 12, marginTop: 4, paddingLeft: 12, borderLeft: `2px solid ${isEpic ? 'rgba(212,175,55,0.4)' : '#DCDEE0'}` }}>
          {group.issues.map(issue => {
            const added = entries.some(e => e.issueKey === issue.key);
            const ts = ISSUE_TYPE_STYLES[issue.issueType] || { emoji: "📄", color: "#9CA3AF" };
            return (
              <div key={issue.key} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 10px', marginBottom: 4, borderRadius: 3, border: '1px solid', borderColor: added ? 'rgba(212,175,55,0.4)' : '#DCDEE0', background: added ? '#FFFDF0' : '#fff', gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1C1C1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.summary}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#E30613' }}>{issue.key}</span>
                    <StatusBadge status={issue.status} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => onStartTimer(issue)} title="Iniciar timer" style={{ fontSize: 11, border: '1px solid rgba(212,175,55,0.5)', borderRadius: 3, padding: '3px 6px', background: '#FFFDF0', cursor: 'pointer', color: '#856404' }}>⏱</button>
                  <button onClick={() => onAdd(issue)} disabled={added} style={{ fontSize: 11, border: `1px solid ${added ? '#D4AF37' : '#DCDEE0'}`, borderRadius: 3, padding: '3px 8px', background: added ? '#FFFDF0' : '#fff', color: added ? '#856404' : '#E30613', cursor: added ? 'default' : 'pointer', fontWeight: 700 }}>
                    {added ? "✓" : "+ Agregar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CalendarView({ onTodayHours }: { onTodayHours: (h: number) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dailyHours, setDailyHours] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const today = now.toISOString().split("T")[0];
  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  useEffect(() => { fetchCalendar(); }, [year, month]);
  const fetchCalendar = async () => {
    setLoading(true);
    const res = await fetch(`/api/jira/calendar?year=${year}&month=${month}`);
    if (res.ok) {
      const data = await res.json();
      setDailyHours(data.dailyHours || {});
      if (year === now.getFullYear() && month === now.getMonth() + 1) onTodayHours(data.dailyHours?.[today] || 0);
    }
    setLoading(false);
  };
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const getDayStyle = (dateStr: string, dow: number) => {
    const isWeekend = dow === 0 || dow === 6;
    const hours = dailyHours[dateStr] || 0;
    const isFuture = dateStr > today;
    if (isWeekend) return { bg: '#F9FAFB', numColor: '#D1D5DB', bar: null, label: null };
    if (isFuture) return { bg: '#fff', numColor: '#9CA3AF', bar: null, label: null };
    if (hours > JORNADA_HORAS) return { bg: '#FEF2F2', numColor: '#991B1B', bar: '#EF4444', label: `⚠ ${hours.toFixed(1)}h` };
    if (hours >= JORNADA_HORAS) return { bg: '#ECFDF5', numColor: '#065F46', bar: '#10B981', label: `${hours.toFixed(1)}h` };
    if (hours > 0) return { bg: '#FFFBEB', numColor: '#92400E', bar: '#F59E0B', label: `${hours.toFixed(1)}h` };
    return { bg: '#FEF2F2', numColor: '#FDA4AF', bar: null, label: null };
  };

  const totalHours = Object.values(dailyHours).reduce((a, b) => a + b, 0);
  const workedDays = Object.keys(dailyHours).filter(d => { const dow = new Date(d + "T12:00:00").getDay(); return dow !== 0 && dow !== 6; }).length;

  return (
    <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, boxShadow: '0 1px 0 rgba(28,28,28,0.04), 0 8px 24px -12px rgba(28,28,28,0.25)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1C', margin: 0 }}>Calendario de imputaciones</h2>
          <p style={{ fontSize: 11, color: '#6B6B6B', margin: '3px 0 0' }}>{loading ? 'Cargando...' : `${workedDays} días imputados · ${totalHours.toFixed(1)}h totales`}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={{ width: 28, height: 28, border: '1px solid #DCDEE0', borderRadius: 3, background: '#F9FAFB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>◀</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1C', minWidth: 120, textAlign: 'center' }}>{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} disabled={year === now.getFullYear() && month === now.getMonth() + 1} style={{ width: 28, height: 28, border: '1px solid #DCDEE0', borderRadius: 3, background: '#F9FAFB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, opacity: (year === now.getFullYear() && month === now.getMonth() + 1) ? 0.4 : 1 }}>▶</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {[['#10B981','Completo (8h)'],['#F59E0B','Parcial'],['#FDA4AF','Sin imputar'],['#EF4444','Más de 8h']].map(([c,l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B6B6B' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
          </span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#6B6B6B', padding: '4px 0', background: '#F9FAFB', borderRadius: 2 }}>{d}</div>)}
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const { bg, numColor, bar, label } = getDayStyle(dateStr, idx % 7);
          const isToday = dateStr === today;
          return (
            <div key={dateStr} style={{ background: bg, borderRadius: 3, padding: '4px 5px', minHeight: 52, display: 'flex', flexDirection: 'column', outline: isToday ? '2px solid #E30613' : 'none', outlineOffset: -2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#E30613' : numColor }}>{day}</span>
              {bar && (
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ height: 4, borderRadius: 99, background: bar, marginTop: 4, width: `${Math.min((dailyHours[dateStr] || 0) / JORNADA_HORAS * 100, 100)}%` }} />
                  <span style={{ fontSize: 9, color: '#6B6B6B', marginTop: 2, display: 'block' }}>{label}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupIssues(issues: Issue[]): Group[] {
  const groups: Record<string, Group> = {};
  for (const issue of issues) {
    const key = issue.parentKey || "__none__";
    if (!groups[key]) groups[key] = { parentKey: issue.parentKey, parentSummary: issue.parentSummary, issues: [] };
    groups[key].issues.push(issue);
  }
  return Object.values(groups).sort((a, b) => {
    if (a.parentKey === null) return 1; if (b.parentKey === null) return -1;
    return (a.parentKey || "").localeCompare(b.parentKey || "");
  });
}

function validateEntries(entries: Entry[]): string | null {
  for (const e of entries) {
    if (e.hours === 0 && e.minutes === 0) return `${e.issueKey}: el tiempo no puede ser 0. Poné al menos 1 minuto.`;
    if (e.hours > 24) return `${e.issueKey}: no podés imputar más de 24h en un día.`;
    if (e.minutes > 59) return `${e.issueKey}: los minutos deben ser entre 0 y 59.`;
  }
  if (entries.reduce((acc, e) => acc + e.hours + e.minutes / 60, 0) > 24) return "El total supera las 24h. Revisá los valores.";
  return null;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [user, setUser] = useState<{ accountId: string; displayName: string; email: string; avatarUrl: string } | null>(null);
  const [issueSearch, setIssueSearch] = useState("");
  const [alreadyLoggedToday, setAlreadyLoggedToday] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTimerTicket, setActiveTimerTicket] = useState<{ key: string; summary: string } | null>(null);

  useEffect(() => {
    fetchUser(); fetchProjects();
    if (!localStorage.getItem("onboarding-seen")) setShowOnboarding(true);
  }, []);
  useEffect(() => { if (selectedProject) fetchIssues(selectedProject); else setIssues([]); setIssueSearch(""); }, [selectedProject]);

  const fetchUser = async () => { const res = await fetch("/api/auth/me"); if (res.status === 401) { setSessionExpired(true); return; } if (res.ok) { const data = await res.json(); setUser(data.user); } };
  const fetchProjects = async () => {
    setLoadingProjects(true);
    const res = await fetch("/api/jira/issues");
    if (res.status === 401) { setSessionExpired(true); return; }
    if (!res.ok) { setError("No se pudieron cargar los proyectos."); setLoadingProjects(false); return; }
    const data = await res.json(); setProjects(data.projects || []); setLoadingProjects(false);
  };
  const fetchIssues = async (pk: string) => {
    setLoadingIssues(true);
    const res = await fetch(`/api/jira/issues?project=${pk}`);
    if (res.status === 401) { setSessionExpired(true); return; }
    const data = await res.json(); setIssues(data.issues || []); setLoadingIssues(false);
  };
  const addEntry = (issue: Issue) => { if (entries.find(e => e.issueKey === issue.key)) return; setEntries([...entries, { issueKey: issue.key, summary: issue.summary, hours: 0, minutes: 0, comment: "" }]); setError(""); };
  const updateEntry = (issueKey: string, field: keyof Entry, value: string | number) => { setEntries(entries.map(e => e.issueKey === issueKey ? { ...e, [field]: value } : e)); setError(""); };
  const removeEntry = (issueKey: string) => setEntries(entries.filter(e => e.issueKey !== issueKey));

  const handleTimerStop = (seconds: number, ticketKey: string, ticketSummary: string) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const existing = entries.find(e => e.issueKey === ticketKey);
    if (existing) {
      updateEntry(ticketKey, "hours", existing.hours + hours);
      updateEntry(ticketKey, "minutes", existing.minutes + minutes);
    } else {
      setEntries(prev => [...prev, { issueKey: ticketKey, summary: ticketSummary, hours, minutes, comment: "" }]);
    }
    setActiveTimerTicket(null);
  };

  const handleStartTimer = (issue: Issue) => { setActiveTimerTicket({ key: issue.key, summary: issue.summary }); };

  const newHoras = entries.reduce((acc, e) => acc + e.hours + e.minutes / 60, 0);
  const totalHoras = alreadyLoggedToday + newHoras;
  const porcentaje = Math.min((totalHoras / JORNADA_HORAS) * 100, 100);
  const llegaObjetivo = totalHoras >= JORNADA_HORAS;
  const superaJornada = totalHoras > JORNADA_HORAS;
  const filteredIssues = issues.filter(i => i.summary.toLowerCase().includes(issueSearch.toLowerCase()) || i.key.toLowerCase().includes(issueSearch.toLowerCase()));
  const groups = groupIssues(filteredIssues);

  const handleSubmit = async () => {
    if (entries.length === 0) return;
    const validationError = validateEntries(entries);
    if (validationError) { setError(validationError); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/jira/worklog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: entries.map(e => ({ ...e, date })) }) });
    if (res.status === 401) { setSessionExpired(true); setSubmitting(false); return; }
    if (!res.ok) { setError("Error al conectar con Jira. Intentá de nuevo."); setSubmitting(false); return; }
    const data = await res.json();
    if (data.errors?.length > 0) { setError(`No se pudieron imputar: ${data.errors.map((e: any) => e.issueKey).join(", ")}`); const failedKeys = data.errors.map((e: any) => e.issueKey); setEntries(prev => prev.filter(e => failedKeys.includes(e.issueKey))); }
    else { setSubmitted(true); setAlreadyLoggedToday(prev => prev + newHoras); }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <main style={{ minHeight: '100vh', background: '#ECF0F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: 4, padding: 40, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', borderTop: '3px solid #D4AF37' }}>
          <div style={{ width: 64, height: 64, background: '#ECFDF5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg style={{ width: 32, height: 32, color: '#10B981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1C', margin: '0 0 8px' }}>¡Horas imputadas!</h2>
          <p style={{ color: '#6B6B6B', margin: '0 0 6px', fontSize: 13 }}>Registraste <strong>{newHoras.toFixed(1)}h</strong> en Jira.</p>
          {superaJornada && <p style={{ color: '#E30613', fontWeight: 700, fontSize: 13, margin: '0 0 16px' }}>⚠ Superaste las 8h del día</p>}
          {!superaJornada && llegaObjetivo && <p style={{ color: '#10B981', fontWeight: 700, fontSize: 13, margin: '0 0 16px' }}>✓ Jornada completa</p>}
          <button onClick={() => { setSubmitted(false); setEntries([]); }} style={{ background: '#E30613', color: '#fff', border: 'none', borderRadius: 3, padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Imputar más horas
          </button>
        </div>
      </main>
    );
  }

  const cardStyle = { background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, boxShadow: '0 1px 0 rgba(28,28,28,0.04), 0 8px 24px -12px rgba(28,28,28,0.25)', padding: 20 };

  return (
    <main style={{ minHeight: '100vh', background: '#ECF0F1', fontFamily: 'Arial, sans-serif' }}>
      {sessionExpired && <SessionExpiredBanner />}
      {showOnboarding && <OnboardingModal onDismiss={() => { localStorage.setItem("onboarding-seen", "true"); setShowOnboarding(false); }} />}

      <AppHeader user={user} activeTab="dashboard" onTimerStop={handleTimerStop} activeTimerTicket={activeTimerTicket} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 22px' }}>
        {error && (
          <div style={{ background: '#FBEEEE', borderLeft: '3px solid #E30613', padding: '10px 14px', fontSize: 12, marginBottom: 16, color: '#8E0000', borderRadius: 3 }}>
            {error}
            <button onClick={() => setError("")} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#8E0000', fontSize: 14 }}>✕</button>
          </div>
        )}

        {/* Progreso */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B6B6B', margin: '0 0 6px' }}>Fecha de imputación</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '8px 10px', fontSize: 13, color: '#1C1C1C', background: '#fff', outline: 'none' }} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B6B6B' }}>Progreso del día</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: superaJornada ? '#E30613' : llegaObjetivo ? '#10B981' : '#1C1C1C' }}>{totalHoras.toFixed(1)}h <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 400 }}>/ {JORNADA_HORAS}h</span></span>
              </div>
              <div style={{ height: 12, background: '#ECF0F1', borderRadius: 99, overflow: 'hidden', display: 'flex', border: '1px solid #DCDEE0' }}>
                <div style={{ height: '100%', background: superaJornada ? '#EF4444' : '#10B981', width: `${Math.min((alreadyLoggedToday / JORNADA_HORAS) * 100, 100)}%`, transition: 'width 0.5s' }} />
                <div style={{ height: '100%', background: '#E30613', width: `${Math.min((newHoras / JORNADA_HORAS) * 100, 100 - (alreadyLoggedToday / JORNADA_HORAS) * 100)}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {alreadyLoggedToday > 0 && <span style={{ fontSize: 11, color: '#6B6B6B', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />{alreadyLoggedToday.toFixed(1)}h ya imputadas</span>}
                  {newHoras > 0 && <span style={{ fontSize: 11, color: '#6B6B6B', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E30613', display: 'inline-block' }} />{newHoras.toFixed(1)}h nuevas</span>}
                </div>
                {superaJornada && <p style={{ fontSize: 11, color: '#E30613', fontWeight: 700, margin: 0 }}>⚠ Superaste las 8h</p>}
                {!superaJornada && llegaObjetivo && <p style={{ fontSize: 11, color: '#10B981', fontWeight: 700, margin: 0 }}>✓ Jornada completa</p>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Panel izquierdo */}
          <div style={cardStyle}>
            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(212,175,55,0.3)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1C', margin: 0 }}>Buscar tickets</h2>
              <p style={{ fontSize: 11, color: '#6B6B6B', margin: '3px 0 0' }}>Click en la épica para expandir</p>
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B6B6B', margin: '0 0 6px' }}>Proyecto</p>
              {loadingProjects ? <div style={{ fontSize: 12, color: '#6B6B6B', display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 14, height: 14, border: '2px solid #DCDEE0', borderTop: '2px solid #E30613', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Cargando...</div>
                : <ProjectSelector projects={projects} value={selectedProject} onChange={setSelectedProject} />}
            </div>
            {selectedProject && (
              <div style={{ marginBottom: 12, position: 'relative' }}>
                <svg style={{ width: 14, height: 14, color: '#9CA3AF', position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Filtrar tickets..." value={issueSearch} onChange={e => setIssueSearch(e.target.value)}
                  style={{ width: '100%', border: '1px solid #DCDEE0', borderRadius: 3, padding: '7px 10px 7px 30px', fontSize: 12, outline: 'none' }} />
              </div>
            )}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {loadingIssues ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '32px 0', fontSize: 13, color: '#6B6B6B' }}><div style={{ width: 16, height: 16, border: '2px solid #DCDEE0', borderTop: '2px solid #E30613', borderRadius: '50%' }} />Cargando tickets...</div>
                : !selectedProject ? <div style={{ textAlign: 'center', padding: '32px 0' }}><div style={{ fontSize: 28, marginBottom: 8 }}>📁</div><p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Elegí un proyecto para ver sus tickets</p></div>
                : filteredIssues.length === 0 ? <p style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#9CA3AF' }}>No se encontraron tickets activos</p>
                : groups.map(group => <EpicGroup key={group.parentKey || "__none__"} group={group} entries={entries} onAdd={addEntry} onStartTimer={handleStartTimer} />)}
            </div>
          </div>

          {/* Panel derecho */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(212,175,55,0.3)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1C', margin: 0 }}>Horas del día</h2>
              <p style={{ fontSize: 11, color: '#6B6B6B', margin: '3px 0 0' }}>{entries.length === 0 ? 'Ningún ticket seleccionado' : `${entries.length} ticket${entries.length > 1 ? 's' : ''} seleccionado${entries.length > 1 ? 's' : ''}`}</p>
            </div>
            {entries.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⏱</div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#6B6B6B', margin: 0 }}>Sin tickets seleccionados</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>Agregá tickets desde el panel izquierdo</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {entries.map(entry => {
                  const hasError = entry.hours === 0 && entry.minutes === 0;
                  return (
                    <div key={entry.issueKey} style={{ padding: 12, borderRadius: 3, border: `1px solid ${hasError ? '#E30613' : 'rgba(212,175,55,0.3)'}`, background: hasError ? '#FBEEEE' : '#FFFDF0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1C', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{entry.summary}</p>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#E30613' }}>{entry.issueKey}</span>
                          {hasError && <p style={{ fontSize: 11, color: '#E30613', margin: '2px 0 0' }}>⚠ Poné al menos 1 minuto</p>}
                        </div>
                        <button onClick={() => removeEntry(entry.issueKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: '0 0 0 8px' }}>✕</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', background: '#fff' }}>
                          <input type="number" min={0} max={24} value={entry.hours} onChange={e => updateEntry(entry.issueKey, "hours", parseInt(e.target.value) || 0)} style={{ width: 36, textAlign: 'center', fontSize: 14, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent' }} />
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>h</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', background: '#fff' }}>
                          <input type="number" min={0} max={59} step={15} value={entry.minutes} onChange={e => updateEntry(entry.issueKey, "minutes", parseInt(e.target.value) || 0)} style={{ width: 36, textAlign: 'center', fontSize: 14, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent' }} />
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>min</span>
                        </div>
                        <input type="text" placeholder="Comentario (opcional)" value={entry.comment} onChange={e => updateEntry(entry.issueKey, "comment", e.target.value)}
                          style={{ flex: 1, border: '1px solid #DCDEE0', borderRadius: 3, padding: '6px 10px', fontSize: 12, outline: 'none', background: '#fff' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {entries.length > 0 && (
              <button onClick={handleSubmit} disabled={submitting || newHoras === 0}
                style={{ marginTop: 14, width: '100%', background: newHoras === 0 ? '#ECF0F1' : '#E30613', color: newHoras === 0 ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 3, padding: '12px', fontSize: 14, fontWeight: 700, cursor: newHoras === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {submitting ? 'Imputando...' : `Imputar ${newHoras.toFixed(1)}h en Jira →`}
              </button>
            )}
          </div>
        </div>

        <CalendarView onTodayHours={setAlreadyLoggedToday} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}