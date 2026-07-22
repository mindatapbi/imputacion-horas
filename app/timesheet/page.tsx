"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Entry {
  worklogId: string;
  issueKey: string;
  issueSummary: string;
  issueType: string;
  project: string;
  projectKey: string;
  date: string;
  hours: number;
  minutes: number;
  timeSpentSeconds: number;
  comment: string;
}

interface DayGroup { date: string; entries: Entry[]; totalSeconds: number; }

const OBJETIVO_HORAS = 7.2;
const JORNADA_HORAS = 8;

const ISSUE_TYPE_STYLES: Record<string, { bg: string; text: string; emoji: string }> = {
  "Epic":     { bg: "bg-purple-100", text: "text-purple-700", emoji: "⚡" },
  "Story":    { bg: "bg-green-100",  text: "text-green-700",  emoji: "📗" },
  "Task":     { bg: "bg-blue-100",   text: "text-blue-700",   emoji: "✅" },
  "Sub-task": { bg: "bg-gray-100",   text: "text-gray-600",   emoji: "↳" },
  "Bug":      { bg: "bg-red-100",    text: "text-red-700",    emoji: "🐛" },
};

function IssueTypeBadge({ type }: { type: string }) {
  const s = ISSUE_TYPE_STYLES[type] || { bg: "bg-gray-100", text: "text-gray-600", emoji: "📄" };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.emoji} {type}</span>;
}

function fmtTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

function EditModal({ entry, onSave, onClose }: { entry: Entry; onSave: (e: Entry) => void; onClose: () => void }) {
  const [hours, setHours] = useState(entry.hours);
  const [minutes, setMinutes] = useState(entry.minutes);
  const [comment, setComment] = useState(entry.comment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true); setError("");
    const res = await fetch("/api/jira/timesheet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueKey: entry.issueKey, worklogId: entry.worklogId, hours, minutes, comment, date: entry.date }),
    });
    if (res.ok) { onSave({ ...entry, hours, minutes, timeSpentSeconds: hours * 3600 + minutes * 60, comment }); }
    else { setError("No se pudo guardar. Intentá de nuevo."); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">Editar registro</h3>
            <p className="text-xs text-blue-500 font-mono font-semibold mt-0.5">{entry.issueKey}</p>
            <p className="text-sm text-gray-600 mt-0.5 truncate max-w-xs">{entry.issueSummary}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Tiempo</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                <input type="number" min={0} max={24} value={hours} onChange={e => setHours(parseInt(e.target.value) || 0)} className="w-12 text-center text-lg font-bold text-gray-900 focus:outline-none bg-transparent" />
                <span className="text-sm text-gray-400 font-medium">h</span>
              </div>
              <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                <input type="number" min={0} max={59} step={15} value={minutes} onChange={e => setMinutes(parseInt(e.target.value) || 0)} className="w-12 text-center text-lg font-bold text-gray-900 focus:outline-none bg-transparent" />
                <span className="text-sm text-gray-400 font-medium">min</span>
              </div>
              <span className="text-sm text-gray-400">= {fmtTime(hours * 3600 + minutes * 60)}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Comentario</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Comentario (opcional)" />
          </div>
        </div>
        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TimesheetPage() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ displayName: string; email: string; avatarUrl: string } | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { fetchUser(); }, []);
  useEffect(() => { if (from && to && from <= to) fetchTimesheet(); }, [from, to]);

  const fetchUser = async () => { const res = await fetch("/api/auth/me"); if (res.ok) { const data = await res.json(); setUser(data.user); } };

  const fetchTimesheet = async () => {
    setLoading(true); setError("");
    const res = await fetch(`/api/jira/timesheet?from=${from}&to=${to}`);
    if (res.status === 401) { window.location.href = "/"; return; }
    if (res.ok) { const data = await res.json(); setEntries(data.entries || []); }
    else setError("Error al cargar el timesheet.");
    setLoading(false);
  };

  const handleSaveEdit = (updated: Entry) => {
    setEntries(prev => prev.map(e => e.worklogId === updated.worklogId ? updated : e));
    setEditingEntry(null);
  };

  const handleDelete = async (entry: Entry) => {
    if (!confirm(`¿Eliminar ${fmtTime(entry.timeSpentSeconds)} de ${entry.issueKey}?`)) return;
    setDeletingId(entry.worklogId);
    const res = await fetch("/api/jira/timesheet", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueKey: entry.issueKey, worklogId: entry.worklogId }),
    });
    if (res.ok) setEntries(prev => prev.filter(e => e.worklogId !== entry.worklogId));
    else setError("No se pudo eliminar el registro.");
    setDeletingId(null);
  };

  // Agrupar por día
  const dayGroups: DayGroup[] = [];
  const dayMap: Record<string, DayGroup> = {};
  for (const entry of entries) {
    if (!dayMap[entry.date]) { dayMap[entry.date] = { date: entry.date, entries: [], totalSeconds: 0 }; dayGroups.push(dayMap[entry.date]); }
    dayMap[entry.date].entries.push(entry);
    dayMap[entry.date].totalSeconds += entry.timeSpentSeconds;
  }

  const totalSeconds = entries.reduce((acc, e) => acc + e.timeSpentSeconds, 0);
  const workingDays = dayGroups.filter(d => { const dow = new Date(d.date + "T12:00:00").getDay(); return dow !== 0 && dow !== 6; });
  const completeDays = workingDays.filter(d => d.totalSeconds >= OBJETIVO_HORAS * 3600).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg style={{width:18,height:18}} className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">Imputación de Horas</span>
          </div>
          <nav className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <Link href="/dashboard" className="px-4 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 rounded-lg transition-colors">Dashboard</Link>
            <span className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg">Timesheet</span>
          </nav>
          {user && (
            <div className="flex items-center gap-3">
              {user.avatarUrl ? <img src={user.avatarUrl} className="w-8 h-8 rounded-full ring-2 ring-gray-100" alt={user.displayName} /> : <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{user.displayName.charAt(0)}</div>}
              <div className="hidden sm:block"><p className="text-sm font-medium text-gray-900 leading-tight">{user.displayName}</p><p className="text-xs text-gray-400 leading-tight">{user.email}</p></div>
              <a href="/api/auth/logout" className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1 border border-gray-200 rounded-lg px-2.5 py-1.5">Salir</a>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Selector de período + stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Período</label>
              <div className="flex items-center gap-2">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="date" value={to} max={today} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={fetchTimesheet} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                  {loading ? "..." : "Buscar"}
                </button>
              </div>
            </div>
            {!loading && entries.length > 0 && (
              <div className="flex items-center gap-5">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{fmtTime(totalSeconds)}</p>
                  <p className="text-xs text-gray-400">Total registrado</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{completeDays}</p>
                  <p className="text-xs text-gray-400">Días completos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{workingDays.length}</p>
                  <p className="text-xs text-gray-400">Días con registro</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-100 rounded-xl"><p className="text-sm text-red-600">{error}</p></div>}

        {/* Lista de días */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex items-center justify-center gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            Cargando registros...
          </div>
        ) : dayGroups.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <p className="text-sm font-medium text-gray-400">No hay registros en este período</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayGroups.map(day => {
              const dow = new Date(day.date + "T12:00:00").getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isComplete = day.totalSeconds >= OBJETIVO_HORAS * 3600;
              const pct = Math.min((day.totalSeconds / (JORNADA_HORAS * 3600)) * 100, 100);
              return (
                <div key={day.date} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Header del día */}
                  <div className={`px-5 py-3 flex items-center justify-between ${isComplete ? "bg-green-50" : isWeekend ? "bg-gray-50" : "bg-orange-50"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isComplete ? "bg-green-500" : isWeekend ? "bg-gray-300" : "bg-orange-400"}`} />
                      <span className="text-sm font-semibold text-gray-900 capitalize">{fmtDate(day.date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isComplete ? "bg-green-500" : "bg-orange-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-sm font-bold ${isComplete ? "text-green-700" : "text-orange-600"}`}>{fmtTime(day.totalSeconds)}</span>
                      </div>
                      {isComplete && <span className="text-xs text-green-600 font-medium bg-green-100 px-2 py-0.5 rounded-full">✓ Completo</span>}
                    </div>
                  </div>

                  {/* Entradas del día */}
                  <div className="divide-y divide-gray-50">
                    {day.entries.map(entry => (
                      <div key={entry.worklogId} className={`px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors ${deletingId === entry.worklogId ? "opacity-40" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-semibold text-blue-500">{entry.issueKey}</span>
                            <IssueTypeBadge type={entry.issueType} />
                            <span className="text-xs text-gray-400">{entry.project}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{entry.issueSummary}</p>
                          {entry.comment && <p className="text-xs text-gray-400 mt-0.5 truncate">💬 {entry.comment}</p>}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm font-bold text-gray-900 w-16 text-right">{fmtTime(entry.timeSpentSeconds)}</span>
                          <button onClick={() => setEditingEntry(entry)} className="text-gray-300 hover:text-blue-500 transition-colors p-1.5 rounded-lg hover:bg-blue-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(entry)} disabled={deletingId === entry.worklogId} className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingEntry && <EditModal entry={editingEntry} onSave={handleSaveEdit} onClose={() => setEditingEntry(null)} />}
    </main>
  );
}