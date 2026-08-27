"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface User {
  displayName: string;
  email: string;
  avatarUrl: string;
}

interface TimerState {
  running: boolean;
  startedAt: number | null;
  elapsed: number;
  ticketKey: string;
  ticketSummary: string;
}

interface Props {
  user: User | null;
  activeTab: "dashboard" | "timesheet" | "upload";
  onTimerStop?: (seconds: number, ticketKey: string, ticketSummary: string) => void;
  activeTimerTicket?: { key: string; summary: string } | null;
  onStartTimer?: (key: string, summary: string) => void;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtTimer(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export default function AppHeader({ user, activeTab, onTimerStop, activeTimerTicket }: Props) {
  const [timer, setTimer] = useState<TimerState>({
    running: false, startedAt: null, elapsed: 0, ticketKey: "", ticketSummary: ""
  });
  const [isMobile, setIsMobile] = useState(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (activeTimerTicket && !timer.running) {
      setTimer({ running: true, startedAt: Date.now(), elapsed: 0, ticketKey: activeTimerTicket.key, ticketSummary: activeTimerTicket.summary });
    }
  }, [activeTimerTicket]);

  useEffect(() => {
    if (timer.running) {
      interval.current = setInterval(() => {
        setTimer(prev => ({ ...prev, elapsed: prev.elapsed + 1 }));
      }, 1000);
    } else {
      if (interval.current) clearInterval(interval.current);
    }
    return () => { if (interval.current) clearInterval(interval.current); };
  }, [timer.running]);

  const stopTimer = () => {
    if (onTimerStop) onTimerStop(timer.elapsed, timer.ticketKey, timer.ticketSummary);
    setTimer({ running: false, startedAt: null, elapsed: 0, ticketKey: "", ticketSummary: "" });
  };

  const isRunning = timer.running;

  return (
    <header style={{
      background: '#fff',
      borderBottom: '1px solid #DCDEE0',
      boxShadow: '0 1px 0 rgba(212,175,55,0.2)',
      display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 20,
      padding: isMobile ? '8px 12px' : '10px 22px',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingRight: isMobile ? 10 : 20, borderRight: '1px solid rgba(212,175,55,0.45)', flexShrink: 0 }}>
        <img src="/mindata-logo.png" alt="Mindata" style={{ height: isMobile ? 18 : 22, width: 'auto' }} />
        {!isMobile && <p style={{ fontSize: 9, letterSpacing: '0.18em', color: '#6B6B6B', textTransform: 'uppercase', margin: 0 }}>Carga de Horas</p>}
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 2, marginRight: 'auto' }}>
        <Link href="/dashboard" style={{
          background: 'none', border: 0,
          borderBottom: activeTab === 'dashboard' ? '2px solid #E30613' : '2px solid transparent',
          padding: isMobile ? '6px 10px' : '8px 14px',
          fontWeight: 700, fontSize: isMobile ? 12 : 13,
          color: activeTab === 'dashboard' ? '#E30613' : '#6B6B6B',
          cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
          transition: 'color 0.12s',
        }}>
          Registro
        </Link>
        <Link href="/timesheet" style={{
          background: 'none', border: 0,
          borderBottom: activeTab === 'timesheet' ? '2px solid #E30613' : '2px solid transparent',
          padding: isMobile ? '6px 10px' : '8px 14px',
          fontWeight: 700, fontSize: isMobile ? 12 : 13,
          color: activeTab === 'timesheet' ? '#E30613' : '#6B6B6B',
          cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
          transition: 'color 0.12s',
        }}>
          Consultar
        </Link>
        <Link href="/upload" style={{
          // No mostrar
           display: 'none',
          // Mostrar
          // display: 'inline-block',
          background: 'none', border: 0,
          borderBottom: activeTab === 'upload' ? '2px solid #E30613' : '2px solid transparent',
          padding: isMobile ? '6px 10px' : '8px 14px',
          fontWeight: 700, fontSize: isMobile ? 12 : 13,
          color: activeTab === 'upload' ? '#E30613' : '#6B6B6B',
          cursor: 'pointer', textDecoration: 'none',
          transition: 'color 0.12s',
        }}>
          Carga masiva
        </Link>
      </nav>

      {/* Timer */}
      {isRunning && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid #E30613', borderRadius: 3,
          padding: isMobile ? '3px 6px' : '4px 6px 4px 10px',
          background: '#FBEEEE', flexShrink: 0,
        }}>
          {!isMobile && (
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#E30613', display: 'block' }}>{timer.ticketKey}</span>
              <span style={{ fontSize: 10, color: '#6B6B6B', display: 'block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timer.ticketSummary}</span>
            </div>
          )}
          {isMobile && <span style={{ fontSize: 11, fontWeight: 700, color: '#E30613' }}>{timer.ticketKey}</span>}
          <span style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, minWidth: 58, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1C1C1C' }}>
            {fmtTimer(timer.elapsed)}
          </span>
          <button onClick={stopTimer} style={{
            background: '#E30613', color: '#fff', border: 'none',
            borderRadius: 3, padding: isMobile ? '3px 6px' : '4px 8px',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>
            ■
          </button>
        </div>
      )}

      {/* Usuario */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 9, flexShrink: 0 }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} style={{ width: 28, height: 28, borderRadius: '50%' }} alt={user.displayName} />
            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E30613', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{user.displayName.charAt(0)}</div>
          }
          {!isMobile && (
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: '#1C1C1C' }}>{user.displayName}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#6B6B6B' }}>{user.email}</p>
            </div>
          )}
          <a href="/api/auth/logout" style={{ fontSize: 11, color: '#6B6B6B', border: '1px solid #DCDEE0', borderRadius: 3, padding: '4px 8px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {isMobile ? '↩' : 'Salir'}
          </a>
        </div>
      )}
    </header>
  );
}