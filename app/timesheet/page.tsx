"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import AppHeader from "@/components/AppHeader";

interface Entry {
  worklogId: string; issueKey: string; issueSummary: string; issueType: string;
  project: string; projectKey: string; parentKey: string | null; parentSummary: string | null;
  date: string; hours: number; minutes: number; timeSpentSeconds: number; comment: string; status: string;
}

const EPIC_COLORS = ['#E30613','#D4AF37','#2563EB','#7C3AED','#059669','#DC2626','#F59E0B','#0891B2','#BE185D','#065F46'];

function secsToDisplay(s: number): string {
  if (!s) return "0:00";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}
function fmtDate(d: string) { return new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday:"short", day:"numeric", month:"short" }); }
function fmtDateLong(d: string) { return new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long" }).toUpperCase(); }
function parseToSeconds(val: string): number {
  const v = val.trim(); if (!v) return 0;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 3600);
  const hm1 = v.match(/^(\d+):(\d+)$/); if (hm1) return (parseInt(hm1[1]) * 60 + parseInt(hm1[2])) * 60;
  const hm2 = v.match(/^(\d+)h(\d+)m?$/i); if (hm2) return (parseInt(hm2[1]) * 60 + parseInt(hm2[2])) * 60;
  const hOnly = v.match(/^(\d+)h$/i); if (hOnly) return parseInt(hOnly[1]) * 3600;
  const mOnly = v.match(/^(\d+)m$/i); if (mOnly) return parseInt(mOnly[1]) * 60;
  return 0;
}

export default function ConsultarPage() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const [from, setFrom] = useState(fmt(firstOfMonth));
  const [to, setTo] = useState(fmt(now));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ displayName: string; email: string; avatarUrl: string } | null>(null);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Filtros
  const [filterProject, setFilterProject] = useState("");
  const [filterEpic, setFilterEpic] = useState("");
  const [filterIssue, setFilterIssue] = useState("");
  const [filterComment, setFilterComment] = useState("");
  const [groupBy, setGroupBy] = useState<"day"|"epic"|"project"|"issue">("day");
  const [showFilters, setShowFilters] = useState(false);

  // Selección masiva
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveDate, setMoveDate] = useState("");

  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editComment, setEditComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check);
  }, []);
  useEffect(() => { fetchUser(); }, []);
  useEffect(() => { if (from && to && from <= to) fetchEntries(); }, [from, to]);

  const fetchUser = async () => { const r = await fetch("/api/auth/me"); if (r.ok) { const d = await r.json(); setUser(d.user); } };
  const fetchEntries = async () => {
    setLoading(true); setError(""); setSelected(new Set()); setEditingId(null);
    const r = await fetch(`/api/jira/timesheet?from=${from}&to=${to}`);
    if (r.status === 401) { window.location.href = "/"; return; }
    if (r.ok) { const d = await r.json(); setEntries(d.entries || []); } else setError("Error al cargar los registros.");
    setLoading(false);
  };

  const filtered = entries.filter(e =>
    (!filterProject || e.project === filterProject) &&
    (!filterEpic || e.parentSummary === filterEpic) &&
    (!filterIssue || e.issueKey === filterIssue) &&
    (!filterComment || (e.comment || "").toLowerCase().includes(filterComment.toLowerCase()))
  );

  const totalSecs = filtered.reduce((a, e) => a + e.timeSpentSeconds, 0);
  const uniqueDays = new Set(filtered.map(e => e.date)).size;
  const uniqueIssues = new Set(filtered.map(e => e.issueKey)).size;
  const avgPerDay = uniqueDays > 0 ? totalSecs / uniqueDays : 0;

  const epicTotals: Record<string, number> = {};
  for (const e of filtered) { const epic = e.parentSummary || "Sin épica"; epicTotals[epic] = (epicTotals[epic] || 0) + e.timeSpentSeconds; }
  const epicEntries = Object.entries(epicTotals).sort((a, b) => b[1] - a[1]);

  const groupKey = (e: Entry) => {
    if (groupBy === "day") return e.date;
    if (groupBy === "epic") return e.parentSummary || "Sin épica";
    if (groupBy === "project") return e.project;
    return `${e.issueKey} · ${e.issueSummary}`;
  };
  const grouped: Record<string, Entry[]> = {};
  for (const e of filtered) { const k = groupKey(e); if (!grouped[k]) grouped[k] = []; grouped[k].push(e); }
  const groupKeys = Object.keys(grouped).sort((a, b) => groupBy === "day" ? b.localeCompare(a) : a.localeCompare(b));

  const toggleSelect = (id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectAll = () => setSelected(new Set(filtered.map(e => e.worklogId)));
  const clearSelect = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selected.size} registros?`)) return;
    setSaving(true);
    for (const e of filtered.filter(e => selected.has(e.worklogId))) {
      await fetch("/api/jira/timesheet", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueKey: e.issueKey, worklogId: e.worklogId }) });
    }
    clearSelect(); await fetchEntries(); setSaving(false);
  };

  const handleBulkMove = async () => {
    if (!moveDate) return; setSaving(true);
    for (const e of filtered.filter(e => selected.has(e.worklogId))) {
      await fetch("/api/jira/timesheet", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueKey: e.issueKey, worklogId: e.worklogId, hours: e.hours, minutes: e.minutes, comment: e.comment, date: moveDate }) });
    }
    clearSelect(); await fetchEntries(); setSaving(false);
  };

  const startEdit = (e: Entry) => {
    setEditingId(e.worklogId);
    const h = Math.floor(e.timeSpentSeconds / 3600), m = Math.floor((e.timeSpentSeconds % 3600) / 60);
    setEditTime(m === 0 ? `${h}h` : `${h}h${m}m`); setEditComment(e.comment || "");
  };
  const saveEdit = async (e: Entry) => {
    setSaving(true);
    const secs = parseToSeconds(editTime); const hours = Math.floor(secs / 3600); const minutes = Math.floor((secs % 3600) / 60);
    await fetch("/api/jira/timesheet", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueKey: e.issueKey, worklogId: e.worklogId, hours, minutes, comment: editComment, date: e.date }) });
    setEditingId(null); await fetchEntries(); setSaving(false);
  };
  const handleDelete = async (e: Entry) => {
    if (!confirm(`¿Eliminar ${secsToDisplay(e.timeSpentSeconds)} de ${e.issueKey}?`)) return;
    await fetch("/api/jira/timesheet", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueKey: e.issueKey, worklogId: e.worklogId }) });
    await fetchEntries();
  };

  const exportExcel = () => {
    const head = ["Fecha","Incidencia","Título","Épica","Proyecto","Horas","Detalle"];
    const rows2 = filtered.map(e => [e.date, e.issueKey, e.issueSummary, e.parentSummary||"", e.project, (e.timeSpentSeconds/3600).toFixed(2), e.comment||""]);
    const ws = XLSX.utils.aoa_to_sheet([head, ...rows2]);
    ws['!cols'] = [{wch:12},{wch:12},{wch:40},{wch:30},{wch:20},{wch:8},{wch:30}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Horas');
    XLSX.writeFile(wb, `horas_${from}_${to}.xlsx`);
  };

  const setThisWeek = () => { const m = new Date(now); m.setDate(now.getDate()-((now.getDay()+6)%7)); const s = new Date(m); s.setDate(m.getDate()+6); setFrom(fmt(m)); setTo(fmt(s)); };
  const setLastWeek = () => { const m = new Date(now); m.setDate(now.getDate()-((now.getDay()+6)%7)-7); const s = new Date(m); s.setDate(m.getDate()+6); setFrom(fmt(m)); setTo(fmt(s)); };
  const setThisMonth = () => { setFrom(fmt(firstOfMonth)); setTo(fmt(now)); };
  const setLastMonth = () => { const f = new Date(now.getFullYear(), now.getMonth()-1, 1); const t = new Date(now.getFullYear(), now.getMonth(), 0); setFrom(fmt(f)); setTo(fmt(t)); };
  const setLast4Weeks = () => { const f = new Date(now); f.setDate(now.getDate()-27); setFrom(fmt(f)); setTo(fmt(now)); };

  const periodButtons = [
    { label: "Esta semana", fn: setThisWeek }, { label: "Sem. pasada", fn: setLastWeek },
    { label: "Este mes", fn: setThisMonth }, { label: "Mes pasado", fn: setLastMonth },
    { label: "4 semanas", fn: setLast4Weeks },
  ];

  const projects = [...new Set(entries.map(e => e.project).filter(Boolean))].sort();
  const epics = [...new Set(entries.map(e => e.parentSummary).filter(Boolean))].sort();
  const issues = [...new Set(entries.map(e => e.issueKey).filter(Boolean))].sort();
  const activeFilters = [filterProject, filterEpic, filterIssue, filterComment].filter(Boolean).length;

  // ─── MOBILE LAYOUT ────────────────────────────────────────────────────────
  if (isMobile) return (
    <main style={{ minHeight: '100vh', background: '#F3F4F6', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <AppHeader user={user} activeTab="timesheet" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Períodos */}
        <div style={{ background: '#fff', borderBottom: '1px solid #DCDEE0', padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 8 }}>
            {periodButtons.map(({ label, fn }) => (
              <button key={label} onClick={fn}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, border: '1px solid #DCDEE0', background: '#fff', color: '#6B6B6B', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ flex: 1, border: '1px solid #DCDEE0', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
            <span style={{ color: '#9CA3AF', fontSize: 13 }}>→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ flex: 1, border: '1px solid #DCDEE0', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
          </div>
        </div>

        {/* KPIs mobile — 2 columnas */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 14px' }}>
            {[
              { val: secsToDisplay(totalSecs), label: 'Horas totales' },
              { val: filtered.length, label: 'Registros' },
              { val: uniqueDays, label: 'Días imputados' },
              { val: secsToDisplay(Math.round(avgPerDay)), label: 'Media por día' },
              { val: uniqueIssues, label: 'Incidencias' },
            ].map(({ val, label }) => (
              <div key={label} style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#E30613' }}>{val}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Barra épicas mobile */}
        {!loading && epicEntries.length > 0 && (
          <div style={{ background: '#fff', margin: '0 14px', borderRadius: 8, border: '1px solid #DCDEE0', padding: '12px 14px', marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 8px', textTransform: 'uppercase' }}>Reparto por épica</p>
            <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
              {epicEntries.map(([epic, secs], i) => (
                <div key={epic} style={{ width: `${secs / totalSecs * 100}%`, background: EPIC_COLORS[i % EPIC_COLORS.length] }} />
              ))}
            </div>
            {epicEntries.slice(0, 3).map(([epic, secs], i) => (
              <div key={epic} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: EPIC_COLORS[i % EPIC_COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: '#6B6B6B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epic}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1C', flexShrink: 0 }}>{secsToDisplay(secs)} · {Math.round(secs / totalSecs * 100)}%</span>
              </div>
            ))}
            {epicEntries.length > 3 && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>+{epicEntries.length - 3} más</p>}
          </div>
        )}

        {/* Filtros mobile — colapsable */}
        <div style={{ margin: '0 14px 8px', background: '#fff', borderRadius: 8, border: '1px solid #DCDEE0', overflow: 'hidden' }}>
          <button onClick={() => setShowFilters(!showFilters)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#1C1C1C' }}>
            <span>Filtros {activeFilters > 0 && <span style={{ background: '#E30613', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{activeFilters}</span>}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{showFilters ? '▲' : '▼'}</span>
          </button>
          {showFilters && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F0F0F0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                style={{ border: '1px solid #DCDEE0', borderRadius: 6, padding: '8px 10px', fontSize: 13, background: '#fff', color: filterProject ? '#E30613' : '#6B6B6B' }}>
                <option value="">Proyecto — todos</option>{projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterEpic} onChange={e => setFilterEpic(e.target.value)}
                style={{ border: '1px solid #DCDEE0', borderRadius: 6, padding: '8px 10px', fontSize: 13, background: '#fff', color: filterEpic ? '#E30613' : '#6B6B6B' }}>
                <option value="">Épica — todas</option>{epics.map(ep => <option key={ep!} value={ep!}>{ep}</option>)}
              </select>
              <select value={filterIssue} onChange={e => setFilterIssue(e.target.value)}
                style={{ border: '1px solid #DCDEE0', borderRadius: 6, padding: '8px 10px', fontSize: 13, background: '#fff', color: filterIssue ? '#E30613' : '#6B6B6B' }}>
                <option value="">Incidencia — todas</option>{issues.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <input type="text" placeholder="Buscar en comentarios..." value={filterComment} onChange={e => setFilterComment(e.target.value)}
                style={{ border: '1px solid #DCDEE0', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)}
                style={{ border: '1px solid #DCDEE0', borderRadius: 6, padding: '8px 10px', fontSize: 13, background: '#fff' }}>
                <option value="day">Agrupar por día</option>
                <option value="epic">Agrupar por épica</option>
                <option value="project">Agrupar por proyecto</option>
                <option value="issue">Agrupar por incidencia</option>
              </select>
              {activeFilters > 0 && (
                <button onClick={() => { setFilterProject(""); setFilterEpic(""); setFilterIssue(""); setFilterComment(""); }}
                  style={{ border: '1px solid #E30613', borderRadius: 6, padding: '8px', fontSize: 13, color: '#E30613', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                  ✕ Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Acción masiva mobile */}
        {selected.size > 0 && (
          <div style={{ margin: '0 14px 8px', background: '#FFFDF0', border: '1px solid rgba(212,175,55,0.5)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>{selected.size} seleccionado{selected.size > 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)}
                style={{ flex: 1, border: '1px solid #DCDEE0', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
              <button onClick={handleBulkMove} disabled={!moveDate || saving}
                style={{ fontSize: 13, fontWeight: 700, background: '#1C1C1C', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', opacity: (!moveDate || saving) ? 0.5 : 1 }}>Mover</button>
              <button onClick={handleBulkDelete} disabled={saving}
                style={{ fontSize: 13, fontWeight: 700, background: '#E30613', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>Eliminar</button>
              <button onClick={clearSelect}
                style={{ fontSize: 13, color: '#6B6B6B', border: '1px solid #DCDEE0', borderRadius: 6, padding: '8px 12px', background: '#fff', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        )}

        {/* Header exportar + total */}
        {!loading && filtered.length > 0 && (
          <div style={{ margin: '0 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#6B6B6B' }}>Total: <strong style={{ color: '#1C1C1C' }}>{secsToDisplay(totalSecs)}</strong></span>
            <button onClick={exportExcel}
              style={{ fontSize: 12, fontWeight: 700, color: '#1F7A44', border: '1px solid #1F7A44', borderRadius: 6, padding: '6px 12px', background: '#fff', cursor: 'pointer' }}>
              ⬇ Excel
            </button>
          </div>
        )}

        {/* Lista de registros mobile — cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 24px' }}>
          {error && <div style={{ background: '#FBEEEE', borderLeft: '3px solid #E30613', padding: '8px 12px', fontSize: 12, color: '#8E0000', borderRadius: 6, marginBottom: 10 }}>{error}</div>}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, border: '2px solid #DCDEE0', borderTop: '2px solid #E30613', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#6B6B6B' }}>Sin registros en este período</p>
            </div>
          ) : groupKeys.map(gk => {
            const groupEntries = grouped[gk];
            const groupTotal = groupEntries.reduce((a, e) => a + e.timeSpentSeconds, 0);
            return (
              <div key={gk} style={{ marginBottom: 16 }}>
                {/* Separador de grupo */}
                <div style={{ background: '#1C1C1C', borderRadius: 6, padding: '8px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textTransform: groupBy === 'day' ? 'uppercase' : 'none' }}>
                    {groupBy === 'day' ? fmtDateLong(gk) : gk}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#D4AF37' }}>{secsToDisplay(groupTotal)}</span>
                </div>
                {/* Cards */}
                {groupEntries.map(e => {
                  const isEditing = editingId === e.worklogId;
                  const epicIdx = epicEntries.findIndex(([ep]) => ep === (e.parentSummary || "Sin épica"));
                  const epicColor = EPIC_COLORS[epicIdx % EPIC_COLORS.length] || '#9CA3AF';
                  return (
                    <div key={e.worklogId} style={{ background: selected.has(e.worklogId) ? '#FFFBEB' : '#fff', border: `1px solid ${selected.has(e.worklogId) ? 'rgba(212,175,55,0.5)' : '#DCDEE0'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <input type="checkbox" checked={selected.has(e.worklogId)} onChange={() => toggleSelect(e.worklogId)}
                          style={{ accentColor: '#E30613', width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                            <a href={`https://factoriamindata.atlassian.net/browse/${e.issueKey}`} target="_blank" rel="noopener"
                              style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#E30613', textDecoration: 'none' }}>{e.issueKey}</a>
                            {groupBy !== 'day' && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtDate(e.date)}</span>}
                            {e.parentSummary && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: epicColor + '22', color: epicColor, border: `1px solid ${epicColor}44`, fontWeight: 700 }}>{e.parentSummary}</span>}
                          </div>
                          <p style={{ margin: '0 0 6px', fontSize: 13, color: '#1C1C1C', fontWeight: 600 }}>{e.issueSummary}</p>
                          {isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <input type="text" inputMode="decimal" value={editTime} onChange={e2 => setEditTime(e2.target.value)} placeholder="Ej: 2h30"
                                style={{ border: '1px solid #E30613', borderRadius: 6, padding: '8px 10px', fontSize: 14, fontWeight: 700, outline: 'none', width: '100%' }} />
                              <input type="text" value={editComment} onChange={e2 => setEditComment(e2.target.value)} placeholder="Comentario"
                                style={{ border: '1px solid #DCDEE0', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%' }} />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => saveEdit(e)} disabled={saving}
                                  style={{ flex: 1, background: '#E30613', color: '#fff', border: 'none', borderRadius: 6, padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
                                <button onClick={() => setEditingId(null)}
                                  style={{ flex: 1, background: '#fff', color: '#6B6B6B', border: '1px solid #DCDEE0', borderRadius: 6, padding: '9px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1C' }}>{secsToDisplay(e.timeSpentSeconds)}</span>
                                {e.comment && <span style={{ fontSize: 12, color: '#6B6B6B', marginLeft: 8 }}>{e.comment}</span>}
                                {!e.comment && <span style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginLeft: 8 }}>sin detalle</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => startEdit(e)}
                                  style={{ background: 'none', border: '1px solid #DCDEE0', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 14, color: '#6B6B6B' }}>✎</button>
                                <button onClick={() => handleDelete(e)}
                                  style={{ background: 'none', border: '1px solid #DCDEE0', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 14, color: '#6B6B6B' }}>🗑</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', background: '#ECF0F1', fontFamily: 'Arial, sans-serif' }}>
      <AppHeader user={user} activeTab="timesheet" />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 4px' }}>HISTÓRICO · EDICIÓN</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E30613', margin: 0 }}>Horas registradas</h2>
            <p style={{ fontSize: 12, color: '#6B6B6B', margin: '3px 0 0' }}>Filtrá, revisá y corregí. Los cambios se aplican registro a registro.</p>
          </div>
          <button onClick={exportExcel} disabled={!filtered.length}
            style={{ fontSize: 12, fontWeight: 700, color: '#fff', border: '1px solid #E30613', borderRadius: 3, padding: '7px 14px', background: '#E30613', cursor: filtered.length ? 'pointer' : 'not-allowed', opacity: filtered.length ? 1 : 0.4 }}>
            ⬇ Exportar Excel
          </button>
        </div>

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { val: secsToDisplay(totalSecs), label: 'HORAS EN EL PERÍODO' },
              { val: filtered.length, label: 'REGISTROS' },
              { val: uniqueDays, label: 'DÍAS CON IMPUTACIÓN' },
              { val: secsToDisplay(Math.round(avgPerDay)), label: 'MEDIA POR DÍA LABORABLE' },
              { val: uniqueIssues, label: 'INCIDENCIAS DISTINTAS' },
            ].map(({ val, label }) => (
              <div key={label} style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, padding: '14px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#E30613' }}>{val}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && epicEntries.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, padding: '14px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 8px' }}>REPARTO POR ÉPICA</p>
            <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
              {epicEntries.map(([epic, secs], i) => (
                <div key={epic} title={`${epic}: ${secsToDisplay(secs)} (${Math.round(secs / totalSecs * 100)}%)`}
                  style={{ width: `${secs / totalSecs * 100}%`, background: EPIC_COLORS[i % EPIC_COLORS.length] }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
              {epicEntries.map(([epic, secs], i) => (
                <span key={epic} style={{ fontSize: 11, color: '#6B6B6B', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: EPIC_COLORS[i % EPIC_COLORS.length], display: 'inline-block' }} />
                  {epic} <strong>{secsToDisplay(secs)}</strong> · {Math.round(secs / totalSecs * 100)}%
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[{ label: "Esta semana", fn: setThisWeek }, { label: "Semana pasada", fn: setLastWeek }, { label: "Este mes", fn: setThisMonth }, { label: "Mes pasado", fn: setLastMonth }, { label: "Últimas 4 semanas", fn: setLast4Weeks }].map(({ label, fn }) => (
              <button key={label} onClick={fn} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 3, border: '1px solid #DCDEE0', background: '#fff', color: '#6B6B6B', cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, outline: 'none' }} />
            <span style={{ color: '#9CA3AF', fontSize: 12 }}>a</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, outline: 'none' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterProject ? '#E30613' : '#6B6B6B' }}>
            <option value="">Proyecto ▾</option>{projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterEpic} onChange={e => setFilterEpic(e.target.value)} style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterEpic ? '#E30613' : '#6B6B6B' }}>
            <option value="">Épica ▾</option>{epics.map(ep => <option key={ep!} value={ep!}>{ep}</option>)}
          </select>
          <select value={filterIssue} onChange={e => setFilterIssue(e.target.value)} style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterIssue ? '#E30613' : '#6B6B6B' }}>
            <option value="">Incidencia ▾</option>{issues.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input type="text" placeholder="🔍 Buscar en comentarios..." value={filterComment} onChange={e => setFilterComment(e.target.value)} style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 10px', fontSize: 12, outline: 'none', minWidth: 200 }} />
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer' }}>
            <option value="day">Por día</option><option value="epic">Por épica</option><option value="project">Por proyecto</option><option value="issue">Por incidencia</option>
          </select>
          {activeFilters > 0 && <button onClick={() => { setFilterProject(""); setFilterEpic(""); setFilterIssue(""); setFilterComment(""); }} style={{ fontSize: 11, color: '#E30613', border: '1px solid #E30613', borderRadius: 3, padding: '4px 8px', background: '#fff', cursor: 'pointer' }}>✕ Limpiar</button>}
        </div>

        {selected.size > 0 && (
          <div style={{ background: '#FFFDF0', border: '1px solid rgba(212,175,55,0.5)', borderRadius: 3, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.size} seleccionado{selected.size > 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#6B6B6B' }}>Mover a:</span>
              <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '4px 8px', fontSize: 12, outline: 'none' }} />
              <button onClick={handleBulkMove} disabled={!moveDate||saving} style={{ fontSize: 12, fontWeight: 700, background: '#1C1C1C', color: '#fff', border: 'none', borderRadius: 3, padding: '5px 12px', cursor: 'pointer', opacity: (!moveDate||saving)?0.5:1 }}>Mover</button>
            </div>
            <button onClick={handleBulkDelete} disabled={saving} style={{ fontSize: 12, fontWeight: 700, background: '#E30613', color: '#fff', border: 'none', borderRadius: 3, padding: '5px 12px', cursor: 'pointer' }}>Eliminar</button>
            <button onClick={clearSelect} style={{ fontSize: 12, color: '#6B6B6B', border: '1px solid #DCDEE0', borderRadius: 3, padding: '4px 10px', background: '#fff', cursor: 'pointer' }}>Quitar selección</button>
          </div>
        )}

        {error && <div style={{ background: '#FBEEEE', borderLeft: '3px solid #E30613', padding: '8px 12px', fontSize: 12, color: '#8E0000', borderRadius: 3 }}>{error}</div>}

        {loading ? (
          <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
            <div style={{ width: 16, height: 16, border: '2px solid #DCDEE0', borderTop: '2px solid #E30613', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Cargando registros...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#6B6B6B' }}>No hay registros en este período</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1C1C1C' }}>
                  <th style={{ width: 36, padding: '8px 12px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={e => e.target.checked ? selectAll() : clearSelect()} style={{ accentColor: '#E30613', width: 14, height: 14 }} />
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Incidencia</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Épica</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 80 }}>Horas</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Detalle</th>
                  <th style={{ width: 60, padding: '8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {groupKeys.map(gk => {
                  const groupEntries = grouped[gk];
                  const groupTotal = groupEntries.reduce((a, e) => a + e.timeSpentSeconds, 0);
                  return (
                    <>
                      <tr key={`g-${gk}`} style={{ background: '#1C1C1C' }}>
                        <td></td>
                        <td colSpan={4} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#fff', textTransform: groupBy === 'day' ? 'uppercase' : 'none' }}>{groupBy === 'day' ? fmtDateLong(gk) : gk}</td>
                        <td colSpan={2} style={{ padding: '7px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#D4AF37' }}>{secsToDisplay(groupTotal)}</td>
                      </tr>
                      {groupEntries.map((e, ei) => {
                        const isEditing = editingId === e.worklogId;
                        const epicIdx = epicEntries.findIndex(([ep]) => ep === (e.parentSummary || "Sin épica"));
                        const epicColor = EPIC_COLORS[epicIdx % EPIC_COLORS.length] || '#9CA3AF';
                        return (
                          <tr key={e.worklogId} style={{ borderBottom: '1px solid #F0F0F0', background: selected.has(e.worklogId) ? '#FFFBEB' : ei % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}><input type="checkbox" checked={selected.has(e.worklogId)} onChange={() => toggleSelect(e.worklogId)} style={{ accentColor: '#E30613', width: 14, height: 14 }} /></td>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: '#6B6B6B', whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <a href={`https://factoriamindata.atlassian.net/browse/${e.issueKey}`} target="_blank" rel="noopener" style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#E30613', textDecoration: 'none' }}>{e.issueKey}</a>
                              {' '}<span style={{ fontSize: 13, color: '#1C1C1C' }}>{e.issueSummary}</span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {e.parentSummary && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: epicColor + '22', color: epicColor, border: `1px solid ${epicColor}44`, fontWeight: 700, whiteSpace: 'nowrap' }}>{e.parentSummary}</span>}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {isEditing ? <input type="text" value={editTime} onChange={e2 => setEditTime(e2.target.value)} style={{ width: 70, textAlign: 'center', border: '1px solid #E30613', borderRadius: 3, padding: '3px 6px', fontSize: 13, fontWeight: 700, outline: 'none' }} />
                                : <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1C' }}>{secsToDisplay(e.timeSpentSeconds)}</span>}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {isEditing ? <input type="text" value={editComment} onChange={e2 => setEditComment(e2.target.value)} placeholder="Detalle" style={{ width: '100%', border: '1px solid #DCDEE0', borderRadius: 3, padding: '3px 8px', fontSize: 12, outline: 'none' }} />
                                : <span style={{ fontSize: 12, color: e.comment ? '#1C1C1C' : '#9CA3AF', fontStyle: e.comment ? 'normal' : 'italic' }}>{e.comment || 'sin detalle'}</span>}
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {isEditing ? (
                                <><button onClick={() => saveEdit(e)} disabled={saving} style={{ fontSize: 11, fontWeight: 700, background: '#E30613', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', cursor: 'pointer', marginRight: 4 }}>Guardar</button>
                                  <button onClick={() => setEditingId(null)} style={{ fontSize: 11, background: 'none', border: '1px solid #DCDEE0', borderRadius: 3, padding: '3px 8px', cursor: 'pointer', color: '#6B6B6B' }}>Cancelar</button></>
                              ) : (
                                <><button onClick={() => startEdit(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DCDEE0', fontSize: 15, padding: '0 4px' }} onMouseOver={e2 => e2.currentTarget.style.color = '#E30613'} onMouseOut={e2 => e2.currentTarget.style.color = '#DCDEE0'}>✎</button>
                                  <button onClick={() => handleDelete(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DCDEE0', fontSize: 15, padding: '0 4px' }} onMouseOver={e2 => e2.currentTarget.style.color = '#E30613'} onMouseOut={e2 => e2.currentTarget.style.color = '#DCDEE0'}>🗑</button></>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#1C1C1C', borderTop: '2px solid rgba(212,175,55,0.4)' }}>
                  <td></td>
                  <td colSpan={2} style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Total del periodo · {filtered.length} registros</td>
                  <td></td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#fff', background: '#0D0D0D' }}>{secsToDisplay(totalSecs)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}