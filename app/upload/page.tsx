"use client";

import { useEffect, useState, useRef } from "react";
import AppHeader from "@/components/AppHeader";
import * as XLSX from "xlsx";

interface User {
  accountId: string; displayName: string; email: string; avatarUrl: string;
}

interface UploadRow {
  rowNum: number;
  ticket: string;
  date: string;
  hours: string;
  comment: string;
  seconds: number;
  valid: boolean;
  error: string;
  status: "pending" | "success" | "error";
  statusMsg: string;
}

function parseToSeconds(val: string): number {
  const v = String(val).trim(); if (!v) return 0;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 3600);
  const hm1 = v.match(/^(\d+):(\d+)$/); if (hm1) return (parseInt(hm1[1]) * 60 + parseInt(hm1[2])) * 60;
  const hm2 = v.match(/^(\d+)h(\d+)m?$/i); if (hm2) return (parseInt(hm2[1]) * 60 + parseInt(hm2[2])) * 60;
  const hOnly = v.match(/^(\d+)h$/i); if (hOnly) return parseInt(hOnly[1]) * 3600;
  const mOnly = v.match(/^(\d+)m$/i); if (mOnly) return parseInt(mOnly[1]) * 60;
  return 0;
}

function secsToDisplay(s: number): string {
  if (!s) return ""; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (m === 0) return `${h}h`; if (h === 0) return `${m}m`; return `${h}h${m}m`;
}

function parseDate(val: any): string {
  if (!val) return "";
  const str = String(val).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // Excel serial number
  if (/^\d+$/.test(str)) {
    const d = new Date(Math.round((parseInt(str) - 25569) * 86400 * 1000));
    return d.toISOString().split("T")[0];
  }
  return "";
}

function validateRow(row: any, rowNum: number): UploadRow {
  const ticket = String(row["Ticket"] || row["ticket"] || "").trim().toUpperCase();
  const dateRaw = row["Fecha"] || row["fecha"] || row["Date"] || row["date"] || "";
  const hoursRaw = String(row["Horas"] || row["horas"] || row["Hours"] || row["hours"] || "").trim();
  const comment = String(row["Comentario"] || row["comentario"] || row["Comment"] || row["comment"] || "").trim();

  const date = parseDate(dateRaw);
  const seconds = parseToSeconds(hoursRaw);

  const errors: string[] = [];
  if (!ticket) errors.push("Ticket vacío");
  else if (!/^[A-Z]+-\d+$/.test(ticket)) errors.push("Formato de ticket inválido (ej: JD-106)");
  if (!date) errors.push("Fecha inválida (usar YYYY-MM-DD o DD/MM/YYYY)");
  if (seconds === 0) errors.push("Horas inválidas o vacías");

  return {
    rowNum,
    ticket,
    date,
    hours: hoursRaw,
    comment,
    seconds,
    valid: errors.length === 0,
    error: errors.join(" · "),
    status: "pending",
    statusMsg: "",
  };
}

export default function UploadPage() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (r.status === 401) setSessionExpired(true); else r.json().then(d => setUser(d.user)); });
  }, []);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const parsed = json.map((row: any, i) => validateRow(row, i + 2));
      setRows(parsed);
      setDone(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["Ticket", "Fecha", "Horas", "Comentario", "Título", "Épica", "Proyecto"],
      ["JD-106", "2026-08-11", "2.50", "Desarrollo feature X", "Investigación Jira Solución carga de horas", "Data - Jira y BI", "Jira | Data"],
      ["PI-242", "2026-08-12", "4.00", "Reunión de equipo", "Desarrollo", "APPH - WebApp Carga de Horas", "Proyectos Internos"],
      ["JD-26", "2026-08-13", "1.50", "Daily standup", "Reuniones Diarias", "Data - Jira y BI", "Jira | Data"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Carga de Horas");
    XLSX.writeFile(wb, "plantilla_carga_horas.xlsx");
  };

  const handleUpload = async () => {
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) return;
    setUploading(true);

    const updated = [...rows];
    for (const row of updated.filter(r => r.valid)) {
      const hours = Math.floor(row.seconds / 3600);
      const minutes = Math.floor((row.seconds % 3600) / 60);
      try {
        const res = await fetch("/api/jira/worklog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: [{ issueKey: row.ticket, hours, minutes, comment: row.comment || "Imputación de horas", date: row.date }] }),
        });
        const data = await res.json();
        if (data.errors?.length > 0 || !res.ok) {
          row.status = "error";
          row.statusMsg = data.errors?.[0] || "Error al guardar";
        } else {
          row.status = "success";
          row.statusMsg = "✓ Guardado";
        }
      } catch {
        row.status = "error";
        row.statusMsg = "Error de red";
      }
    }
    setRows(updated);
    setUploading(false);
    setDone(true);
  };

  const reset = () => { setRows([]); setDone(false); if (fileRef.current) fileRef.current.value = ""; };

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;
  const successCount = rows.filter(r => r.status === "success").length;
  const errorCount = rows.filter(r => r.status === "error" && r.valid).length;

  if (sessionExpired) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 4, maxWidth: 360, textAlign: 'center', borderTop: '3px solid #D4AF37' }}>
        <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Sesión expirada</p>
        <a href="/api/auth/logout" style={{ display: 'block', background: '#E30613', color: '#fff', padding: '10px', borderRadius: 3, textDecoration: 'none', fontWeight: 700 }}>Volver a ingresar</a>
      </div>
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', background: '#ECF0F1', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <AppHeader user={user} activeTab="upload" />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 22px', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 4px' }}>IMPORTACIÓN · BATCH</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E30613', margin: 0 }}>Carga masiva de horas</h2>
            <p style={{ fontSize: 12, color: '#6B6B6B', margin: '3px 0 0' }}>Subí un Excel con tus horas y las cargamos todas en Jira de una vez.</p>
          </div>
          <button onClick={downloadTemplate}
            style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1C', border: '1px solid #DCDEE0', borderRadius: 3, padding: '7px 14px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⬇ Descargar plantilla Excel
          </button>
        </div>

        {/* Zona de carga */}
        {rows.length === 0 && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? '#E30613' : '#DCDEE0'}`, borderRadius: 6, background: dragOver ? '#FBEEEE' : '#fff', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1C1C1C' }}>Arrastrá tu Excel aquí</p>
            <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#9CA3AF' }}>o hacé clic para seleccionar el archivo</p>
            <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>Formatos: .xlsx · .xls · .csv</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <>
            {/* Resumen */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1C' }}>{rows.length}</span>
                <span style={{ fontSize: 12, color: '#6B6B6B' }}>filas totales</span>
              </div>
              <div style={{ background: '#F0FFF4', border: '1px solid #10B981', borderRadius: 3, padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>{validCount}</span>
                <span style={{ fontSize: 12, color: '#10B981' }}>válidas</span>
              </div>
              {invalidCount > 0 && <div style={{ background: '#FFF5F5', border: '1px solid #E30613', borderRadius: 3, padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#E30613' }}>{invalidCount}</span>
                <span style={{ fontSize: 12, color: '#E30613' }}>con errores</span>
              </div>}
              {done && successCount > 0 && <div style={{ background: '#F0FFF4', border: '1px solid #10B981', borderRadius: 3, padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>{successCount}</span>
                <span style={{ fontSize: 12, color: '#10B981' }}>guardadas en Jira ✓</span>
              </div>}
              {done && errorCount > 0 && <div style={{ background: '#FFF5F5', border: '1px solid #E30613', borderRadius: 3, padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#E30613' }}>{errorCount}</span>
                <span style={{ fontSize: 12, color: '#E30613' }}>fallidas</span>
              </div>}
            </div>

            {/* Tabla preview */}
            <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#E30613' }}>
                      <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#fff', width: 50 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff' }}>Ticket</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff' }}>Fecha</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff' }}>Horas</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff' }}>Comentario</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#fff', width: 140 }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F0F0F0', background: !row.valid ? '#FFF5F5' : row.status === 'success' ? '#F0FFF4' : row.status === 'error' ? '#FFF5F5' : i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, color: '#9CA3AF' }}>{row.rowNum}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: row.valid ? '#E30613' : '#9CA3AF' }}>{row.ticket || '—'}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: row.date ? '#1C1C1C' : '#E30613' }}>{row.date || 'Inválida'}</td>
                        <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 700, fontSize: 12, color: row.seconds > 0 ? '#1C1C1C' : '#E30613' }}>
                          {row.seconds > 0 ? secsToDisplay(row.seconds) : row.hours || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#6B6B6B', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.comment || <span style={{ color: '#DCDEE0' }}>Sin comentario</span>}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 12px', fontSize: 11 }}>
                          {!row.valid && <span style={{ color: '#E30613', fontSize: 11 }}>{row.error}</span>}
                          {row.valid && row.status === 'pending' && !done && <span style={{ color: '#9CA3AF' }}>Pendiente</span>}
                          {row.valid && row.status === 'pending' && done && <span style={{ color: '#9CA3AF' }}>—</span>}
                          {row.status === 'success' && <span style={{ color: '#10B981', fontWeight: 700 }}>✓ Guardado</span>}
                          {row.status === 'error' && <span style={{ color: '#E30613' }}>{row.statusMsg}</span>}
                          {uploading && row.valid && row.status === 'pending' && (
                            <div style={{ width: 14, height: 14, border: '2px solid #DCDEE0', borderTop: '2px solid #E30613', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
              <button onClick={reset} style={{ fontSize: 12, color: '#6B6B6B', border: '1px solid #DCDEE0', borderRadius: 3, padding: '8px 16px', background: '#fff', cursor: 'pointer' }}>
                Cargar otro archivo
              </button>
              {!done && validCount > 0 && (
                <button onClick={handleUpload} disabled={uploading}
                  style={{ fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 3, padding: '8px 20px', background: uploading ? '#9CA3AF' : '#E30613', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                  {uploading ? 'Cargando...' : `Cargar ${validCount} registro${validCount !== 1 ? 's' : ''} en Jira`}
                </button>
              )}
              {done && <span style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>✓ Proceso completado — {successCount} de {validCount} guardados</span>}
            </div>
          </>
        )}

        {/* Instrucciones */}
        <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, padding: '16px 20px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#1C1C1C' }}>📋 Formato del Excel</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px', border: '1px solid #DCDEE0', fontWeight: 700, color: '#E30613' }}>Ticket</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', border: '1px solid #DCDEE0', fontWeight: 700, color: '#E30613' }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', border: '1px solid #DCDEE0', fontWeight: 700, color: '#E30613' }}>Horas</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', border: '1px solid #DCDEE0', fontWeight: 700, color: '#E30613' }}>Comentario</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', border: '1px solid #DCDEE0', fontWeight: 700, color: '#9CA3AF' }}>Título / Épica / Proyecto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 12px', border: '1px solid #DCDEE0', fontFamily: 'monospace', color: '#E30613' }}>JD-106</td>
                  <td style={{ padding: '6px 12px', border: '1px solid #DCDEE0' }}>2026-08-11 <span style={{ color: '#9CA3AF' }}>o</span> 11/08/2026</td>
                  <td style={{ padding: '6px 12px', border: '1px solid #DCDEE0' }}>2h30 <span style={{ color: '#9CA3AF' }}>· 2:30 · 90m · 2.5</span></td>
                  <td style={{ padding: '6px 12px', border: '1px solid #DCDEE0', color: '#9CA3AF' }}>Opcional</td>
                  <td style={{ padding: '6px 12px', border: '1px solid #DCDEE0', color: '#9CA3AF' }}>Se ignoran (informativas)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9CA3AF' }}>La primera fila del Excel debe tener los encabezados: <strong>Ticket, Fecha, Horas, Comentario</strong>. Este es el mismo formato que exportás desde <strong>Consultar</strong> — podés descargarlo de ahí y volver a subirlo.</p>
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}