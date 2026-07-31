"use client";

import { useEffect, useState, useRef } from "react";
import AppHeader from "@/components/AppHeader";
import * as XLSX from "xlsx";

interface Entry {
  worklogId: string;
  issueKey: string;
  issueSummary: string;
  issueType: string;
  project: string;
  projectKey: string;
  parentKey: string | null;
  parentSummary: string | null;
  date: string;
  hours: number;
  minutes: number;
  timeSpentSeconds: number;
  comment: string;
  status: string;
}

const EPIC_COLORS = [
  '#E30613','#D4AF37','#2563EB','#7C3AED','#059669','#DC2626','#F59E0B','#0891B2','#BE185D','#065F46'
];

function secsToDisplay(s: number): string {
  if (!s) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday:"short", day:"numeric", month:"short" });
}

function fmtDateLong(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long" }).toUpperCase();
}

function parseToSeconds(val: string): number {
  const v = val.trim();
  if (!v) return 0;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 3600);
  const hm1 = v.match(/^(\d+):(\d+)$/);
  if (hm1) return (parseInt(hm1[1]) * 60 + parseInt(hm1[2])) * 60;
  const hm2 = v.match(/^(\d+)h(\d+)m?$/i);
  if (hm2) return (parseInt(hm2[1]) * 60 + parseInt(hm2[2])) * 60;
  const hOnly = v.match(/^(\d+)h$/i);
  if (hOnly) return parseInt(hOnly[1]) * 3600;
  const mOnly = v.match(/^(\d+)m$/i);
  if (mOnly) return parseInt(mOnly[1]) * 60;
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

  // Filtros
  const [filterProject, setFilterProject] = useState("");
  const [filterEpic, setFilterEpic] = useState("");
  const [filterIssue, setFilterIssue] = useState("");
  const [filterComment, setFilterComment] = useState("");
  const [groupBy, setGroupBy] = useState<"day" | "epic" | "project" | "issue">("day");

  // Selección masiva
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveDate, setMoveDate] = useState("");

  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editComment, setEditComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchUser(); }, []);
  useEffect(() => { if (from && to && from <= to) fetchEntries(); }, [from, to]);

  const fetchUser = async () => {
    const r = await fetch("/api/auth/me");
    if (r.ok) { const d = await r.json(); setUser(d.user); }
  };

  const fetchEntries = async () => {
    setLoading(true); setError(""); setSelected(new Set()); setEditingId(null);
    const r = await fetch(`/api/jira/timesheet?from=${from}&to=${to}`);
    if (r.status === 401) { window.location.href = "/"; return; }
    if (r.ok) { const d = await r.json(); setEntries(d.entries || []); }
    else setError("Error al cargar los registros.");
    setLoading(false);
  };

  // Filtrado
  const filtered = entries.filter(e =>
    (!filterProject || e.project === filterProject) &&
    (!filterEpic || e.parentSummary === filterEpic) &&
    (!filterIssue || e.issueKey === filterIssue) &&
    (!filterComment || (e.comment || "").toLowerCase().includes(filterComment.toLowerCase()))
  );

  // KPIs
  const totalSecs = filtered.reduce((a, e) => a + e.timeSpentSeconds, 0);
  const uniqueDays = new Set(filtered.map(e => e.date)).size;
  const uniqueIssues = new Set(filtered.map(e => e.issueKey)).size;
  const avgPerDay = uniqueDays > 0 ? totalSecs / uniqueDays : 0;

  // Reparto por épica
  const epicTotals: Record<string, number> = {};
  for (const e of filtered) {
    const epic = e.parentSummary || "Sin épica";
    epicTotals[epic] = (epicTotals[epic] || 0) + e.timeSpentSeconds;
  }
  const epicEntries = Object.entries(epicTotals).sort((a, b) => b[1] - a[1]);

  // Agrupación
  const groupKey = (e: Entry) => {
    if (groupBy === "day") return e.date;
    if (groupBy === "epic") return e.parentSummary || "Sin épica";
    if (groupBy === "project") return e.project;
    return `${e.issueKey} · ${e.issueSummary}`;
  };
  const grouped: Record<string, Entry[]> = {};
  for (const e of filtered) {
    const k = groupKey(e);
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(e);
  }
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (groupBy === "day") return b.localeCompare(a); // más reciente primero
    return a.localeCompare(b);
  });

  // Selección
  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectAll = () => setSelected(new Set(filtered.map(e => e.worklogId)));
  const clearSelect = () => setSelected(new Set());

  // Acción masiva — eliminar
  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selected.size} registros?`)) return;
    setSaving(true);
    const toDelete = filtered.filter(e => selected.has(e.worklogId));
    for (const e of toDelete) {
      await fetch("/api/jira/timesheet", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey: e.issueKey, worklogId: e.worklogId }),
      });
    }
    clearSelect(); await fetchEntries(); setSaving(false);
  };

  // Acción masiva — mover fecha
  const handleBulkMove = async () => {
    if (!moveDate) return;
    setSaving(true);
    const toMove = filtered.filter(e => selected.has(e.worklogId));
    for (const e of toMove) {
      await fetch("/api/jira/timesheet", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey: e.issueKey, worklogId: e.worklogId, hours: e.hours, minutes: e.minutes, comment: e.comment, date: moveDate }),
      });
    }
    clearSelect(); await fetchEntries(); setSaving(false);
  };

  // Edición inline
  const startEdit = (e: Entry) => {
    setEditingId(e.worklogId);
    const h = Math.floor(e.timeSpentSeconds / 3600);
    const m = Math.floor((e.timeSpentSeconds % 3600) / 60);
    setEditTime(m === 0 ? `${h}h` : `${h}h${m}m`);
    setEditComment(e.comment || "");
  };

  const saveEdit = async (e: Entry) => {
    setSaving(true);
    const secs = parseToSeconds(editTime);
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    await fetch("/api/jira/timesheet", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueKey: e.issueKey, worklogId: e.worklogId, hours, minutes, comment: editComment, date: e.date }),
    });
    setEditingId(null); await fetchEntries(); setSaving(false);
  };

  const handleDelete = async (e: Entry) => {
    if (!confirm(`¿Eliminar ${secsToDisplay(e.timeSpentSeconds)} de ${e.issueKey}?`)) return;
    await fetch("/api/jira/timesheet", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueKey: e.issueKey, worklogId: e.worklogId }),
    });
    await fetchEntries();
  };

  // Exportar CSV
const exportCSV = () => {
  const head = ["Fecha", "Incidencia", "Título", "Épica", "Proyecto", "Horas", "Detalle"];
  const rows2 = filtered.map(e => [
    e.date, e.issueKey, e.issueSummary,
    e.parentSummary || "", e.project,
    (e.timeSpentSeconds / 3600).toFixed(2),
    e.comment || ""
  ]);
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows2]);
  ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Horas');
  XLSX.writeFile(wb, `horas_${from}_${to}.xlsx`);
};

  // Opciones únicas para filtros
  const projects = [...new Set(entries.map(e => e.project).filter(Boolean))].sort();
  const epics = [...new Set(entries.map(e => e.parentSummary).filter(Boolean))].sort();
  const issues = [...new Set(entries.map(e => e.issueKey).filter(Boolean))].sort();

  // Shortcuts de período
  const setThisWeek = () => {
    const m = new Date(now); m.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const s = new Date(m); s.setDate(m.getDate() + 6);
    setFrom(fmt(m)); setTo(fmt(s));
  };
  const setLastWeek = () => {
    const m = new Date(now); m.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
    const s = new Date(m); s.setDate(m.getDate() + 6);
    setFrom(fmt(m)); setTo(fmt(s));
  };
  const setThisMonth = () => { setFrom(fmt(firstOfMonth)); setTo(fmt(now)); };
  const setLastMonth = () => {
    const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const t = new Date(now.getFullYear(), now.getMonth(), 0);
    setFrom(fmt(f)); setTo(fmt(t));
  };
  const setLast4Weeks = () => {
    const f = new Date(now); f.setDate(now.getDate() - 27);
    setFrom(fmt(f)); setTo(fmt(now));
  };

  const periodButtons = [
    { label: "Esta semana", fn: setThisWeek },
    { label: "Semana pasada", fn: setLastWeek },
    { label: "Este mes", fn: setThisMonth },
    { label: "Mes pasado", fn: setLastMonth },
    { label: "Últimas 4 semanas", fn: setLast4Weeks },
  ];

  const activeLabel = (() => {
    const now2 = new Date();
    const m = new Date(now2); m.setDate(now2.getDate() - ((now2.getDay() + 6) % 7));
    const s = new Date(m); s.setDate(m.getDate() + 6);
    if (from === fmt(m) && to === fmt(s)) return "Esta semana";
    const lm = new Date(m); lm.setDate(m.getDate() - 7);
    const ls = new Date(lm); ls.setDate(lm.getDate() + 6);
    if (from === fmt(lm) && to === fmt(ls)) return "Semana pasada";
    if (from === fmt(firstOfMonth) && to === fmt(now2)) return "Este mes";
    const f4 = new Date(now2); f4.setDate(now2.getDate() - 27);
    if (from === fmt(f4) && to === fmt(now2)) return "Últimas 4 semanas";
    return null;
  })();

  const cardStyle = { background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, padding: '14px 18px' };

  return (
    <main style={{ minHeight: '100vh', background: '#ECF0F1', fontFamily: 'Arial, sans-serif' }}>
      <AppHeader user={user} activeTab="timesheet" />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 4px' }}>HISTÓRICO · EDICIÓN</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E30613', margin: 0 }}>Horas registradas</h2>
            <p style={{ fontSize: 12, color: '#6B6B6B', margin: '3px 0 0' }}>Filtrá, revisá y corregí. Los cambios se aplican registro a registro.</p>
          </div>
          <button onClick={exportCSV} disabled={!filtered.length}
            style={{ fontSize: 12, fontWeight: 700, color: '#1F7A44', border: '1px solid #1F7A44', borderRadius: 3, padding: '7px 14px', background: '#fff', cursor: filtered.length ? 'pointer' : 'not-allowed', opacity: filtered.length ? 1 : 0.4 }}>
            ⬇ Exportar Excel
          </button>
        </div>

        {/* KPIs */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { val: secsToDisplay(totalSecs), label: 'HORAS EN EL PERÍODO' },
              { val: filtered.length, label: 'REGISTROS' },
              { val: uniqueDays, label: 'DÍAS CON IMPUTACIÓN' },
              { val: secsToDisplay(Math.round(avgPerDay)), label: 'MEDIA POR DÍA LABORABLE' },
              { val: uniqueIssues, label: 'INCIDENCIAS DISTINTAS' },
            ].map(({ val, label }) => (
              <div key={label} style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#E30613' }}>{val}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Barra de reparto por épica */}
        {!loading && epicEntries.length > 0 && (
          <div style={cardStyle}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 8px' }}>REPARTO POR ÉPICA</p>
            <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
              {epicEntries.map(([epic, secs], i) => (
                <div key={epic} title={`${epic}: ${secsToDisplay(secs)} (${Math.round(secs / totalSecs * 100)}%)`}
                  style={{ width: `${secs / totalSecs * 100}%`, background: EPIC_COLORS[i % EPIC_COLORS.length], transition: 'width 0.3s' }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
              {epicEntries.map(([epic, secs], i) => (
                <span key={epic} style={{ fontSize: 11, color: '#6B6B6B', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: EPIC_COLORS[i % EPIC_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                  {epic} <strong>{secsToDisplay(secs)}</strong> · {Math.round(secs / totalSecs * 100)}%
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Controles */}
        <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {/* Período */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {periodButtons.map(({ label, fn }) => (
              <button key={label} onClick={fn}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 3, border: '1px solid', borderColor: activeLabel === label ? '#E30613' : '#DCDEE0', background: activeLabel === label ? '#E30613' : '#fff', color: activeLabel === label ? '#fff' : '#6B6B6B', cursor: 'pointer', fontWeight: activeLabel === label ? 700 : 400 }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, outline: 'none' }} />
            <span style={{ color: '#9CA3AF', fontSize: 12 }}>a</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, outline: 'none' }} />
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterProject ? '#E30613' : '#6B6B6B', fontWeight: filterProject ? 700 : 400 }}>
            <option value="">Proyecto ▾</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterEpic} onChange={e => setFilterEpic(e.target.value)}
            style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterEpic ? '#E30613' : '#6B6B6B', fontWeight: filterEpic ? 700 : 400 }}>
            <option value="">Épica ▾</option>
            {epics.map(e => <option key={e!} value={e!}>{e}</option>)}
          </select>
          <select value={filterIssue} onChange={e => setFilterIssue(e.target.value)}
            style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterIssue ? '#E30613' : '#6B6B6B', fontWeight: filterIssue ? 700 : 400 }}>
            <option value="">Incidencia ▾</option>
            {issues.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input type="text" placeholder="🔍 Buscar en comentarios..." value={filterComment} onChange={e => setFilterComment(e.target.value)}
            style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 10px', fontSize: 12, outline: 'none', minWidth: 200 }} />
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)}
            style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: '#6B6B6B' }}>
            <option value="day">Por día</option>
            <option value="epic">Por épica</option>
            <option value="project">Por proyecto</option>
            <option value="issue">Por incidencia</option>
          </select>
          {(filterProject || filterEpic || filterIssue || filterComment) && (
            <button onClick={() => { setFilterProject(""); setFilterEpic(""); setFilterIssue(""); setFilterComment(""); }}
              style={{ fontSize: 11, color: '#E30613', border: '1px solid #E30613', borderRadius: 3, padding: '4px 8px', background: '#fff', cursor: 'pointer' }}>
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Acción masiva */}
        {selected.size > 0 && (
          <div style={{ background: '#FFFDF0', border: '1px solid rgba(212,175,55,0.5)', borderRadius: 3, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1C' }}>{selected.size} seleccionado{selected.size > 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#6B6B6B' }}>Mover a:</span>
              <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)}
                style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '4px 8px', fontSize: 12, outline: 'none' }} />
              <button onClick={handleBulkMove} disabled={!moveDate || saving}
                style={{ fontSize: 12, fontWeight: 700, background: '#1C1C1C', color: '#fff', border: 'none', borderRadius: 3, padding: '5px 12px', cursor: 'pointer', opacity: (!moveDate || saving) ? 0.5 : 1 }}>
                Mover
              </button>
            </div>
            <button onClick={handleBulkDelete} disabled={saving}
              style={{ fontSize: 12, fontWeight: 700, background: '#E30613', color: '#fff', border: 'none', borderRadius: 3, padding: '5px 12px', cursor: 'pointer' }}>
              Eliminar
            </button>
            <button onClick={clearSelect}
              style={{ fontSize: 12, color: '#6B6B6B', border: '1px solid #DCDEE0', borderRadius: 3, padding: '4px 10px', background: '#fff', cursor: 'pointer' }}>
              Quitar selección
            </button>
          </div>
        )}

        {error && <div style={{ background: '#FBEEEE', borderLeft: '3px solid #E30613', padding: '8px 12px', fontSize: 12, color: '#8E0000', borderRadius: 3 }}>{error}</div>}

        {/* Tabla */}
        {loading ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '40px', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, border: '2px solid #DCDEE0', borderTop: '2px solid #E30613', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Cargando registros...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#6B6B6B' }}>No hay registros en este período</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9CA3AF' }}>Cambiá el rango de fechas o quitá los filtros</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1C1C1C' }}>
                  <th style={{ width: 36, padding: '8px 12px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={e => e.target.checked ? selectAll() : clearSelect()}
                      style={{ accentColor: '#E30613', width: 14, height: 14 }} />
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
                      {/* Separador de grupo */}
                      <tr key={`g-${gk}`} style={{ background: '#1C1C1C' }}>
                        <td></td>
                        <td colSpan={4} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#fff', textTransform: groupBy === 'day' ? 'uppercase' : 'none' }}>
                          {groupBy === 'day' ? fmtDateLong(gk) : gk}
                        </td>
                        <td colSpan={2} style={{ padding: '7px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#D4AF37' }}>
                          {secsToDisplay(groupTotal)}
                        </td>
                      </tr>

                      {groupEntries.map((e, ei) => {
                        const isEditing = editingId === e.worklogId;
                        const epicIdx = epicEntries.findIndex(([ep]) => ep === (e.parentSummary || "Sin épica"));
                        const epicColor = EPIC_COLORS[epicIdx % EPIC_COLORS.length] || '#9CA3AF';
                        return (
                          <tr key={e.worklogId} style={{ borderBottom: '1px solid #F0F0F0', background: selected.has(e.worklogId) ? '#FFFBEB' : ei % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <input type="checkbox" checked={selected.has(e.worklogId)} onChange={() => toggleSelect(e.worklogId)}
                                style={{ accentColor: '#E30613', width: 14, height: 14 }} />
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: '#6B6B6B', whiteSpace: 'nowrap' }}>
                              {fmtDate(e.date)}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <a href={`https://factoriamindata.atlassian.net/browse/${e.issueKey}`} target="_blank" rel="noopener"
                                style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#E30613', textDecoration: 'none' }}>{e.issueKey}</a>
                              {' '}<span style={{ fontSize: 13, color: '#1C1C1C' }}>{e.issueSummary}</span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {e.parentSummary && (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: epicColor + '22', color: epicColor, border: `1px solid ${epicColor}44`, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {e.parentSummary}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {isEditing ? (
                                <input type="text" value={editTime} onChange={e2 => setEditTime(e2.target.value)}
                                  style={{ width: 70, textAlign: 'center', border: '1px solid #E30613', borderRadius: 3, padding: '3px 6px', fontSize: 13, fontWeight: 700, outline: 'none' }} />
                              ) : (
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1C' }}>{secsToDisplay(e.timeSpentSeconds)}</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {isEditing ? (
                                <input type="text" value={editComment} onChange={e2 => setEditComment(e2.target.value)}
                                  placeholder="Detalle del trabajo"
                                  style={{ width: '100%', border: '1px solid #DCDEE0', borderRadius: 3, padding: '3px 8px', fontSize: 12, outline: 'none' }} />
                              ) : (
                                <span style={{ fontSize: 12, color: e.comment ? '#1C1C1C' : '#9CA3AF', fontStyle: e.comment ? 'normal' : 'italic' }}>
                                  {e.comment || 'sin detalle'}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {isEditing ? (
                                <>
                                  <button onClick={() => saveEdit(e)} disabled={saving}
                                    style={{ fontSize: 11, fontWeight: 700, background: '#E30613', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', cursor: 'pointer', marginRight: 4 }}>
                                    Guardar
                                  </button>
                                  <button onClick={() => setEditingId(null)}
                                    style={{ fontSize: 11, background: 'none', border: '1px solid #DCDEE0', borderRadius: 3, padding: '3px 8px', cursor: 'pointer', color: '#6B6B6B' }}>
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEdit(e)} title="Editar"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DCDEE0', fontSize: 15, padding: '0 4px' }}
                                    onMouseOver={e2 => e2.currentTarget.style.color = '#E30613'} onMouseOut={e2 => e2.currentTarget.style.color = '#DCDEE0'}>✎</button>
                                  <button onClick={() => handleDelete(e)} title="Eliminar"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DCDEE0', fontSize: 15, padding: '0 4px' }}
                                    onMouseOver={e2 => e2.currentTarget.style.color = '#E30613'} onMouseOut={e2 => e2.currentTarget.style.color = '#DCDEE0'}>🗑</button>
                                </>
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
                  <td colSpan={2} style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    Total del periodo · {filtered.length} registros
                  </td>
                  <td></td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#fff', background: '#0D0D0D' }}>
                    {secsToDisplay(totalSecs)}
                  </td>
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