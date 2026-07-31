import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, sessionOptions } from "@/lib/session";
import { getToken, refreshAccessToken } from "@/lib/redis";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; site?: string }>;
}) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const params = await searchParams;

  if (session.user?.accountId && session.cloudId) {
    const token = await getToken(session.user.accountId) ||
                  await refreshAccessToken(session.user.accountId, session.cloudId);
    if (token) redirect("/dashboard");
    else session.destroy();
  }

  const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${process.env.ATLASSIAN_CLIENT_ID}&scope=read%3Ajira-user%20read%3Ajira-work%20write%3Ajira-work%20read%3Agroup%3Ajira&redirect_uri=${encodeURIComponent(process.env.ATLASSIAN_CALLBACK_URL!)}&response_type=code&prompt=consent`;

  return (
    <main className="min-h-screen flex" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* LADO IZQUIERDO — Marca */}
      <div className="hidden lg:flex flex-col justify-between p-14 flex-1" style={{ background: '#0D0D0D', borderRight: '3px solid #D4AF37' }}>
        {/* Logo */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <img src="/mindata-logo.png" alt="Mindata" className="h-8 w-auto" />
          </div>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginTop: 4 }}>
            Sistema de Imputación de Horas
          </p>
        </div>

        {/* Claim */}
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1.12, letterSpacing: '-0.01em', maxWidth: '14ch', margin: '0 0 28px' }}>
            Registrá tus horas <span style={{ color: '#D4AF37' }}>sin fricción.</span>
          </h1>
          </div>

        <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
          © {new Date().getFullYear()} Mindata · Uso interno
        </p>
      </div>

      {/* LADO DERECHO — Formulario */}
      <div className="flex flex-col items-center justify-center flex-1 p-8" style={{ background: '#fff' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Logo mobile */}
          <div className="lg:hidden mb-8">
            <img src="/mindata-logo.png" alt="Mindata" className="h-7 w-auto" />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#E30613', margin: '0 0 6px' }}>
            Acceder a Carga de Horas
          </h2>
          <p style={{ fontSize: 13, color: '#555', margin: '0 0 28px' }}>
            Usamos tu cuenta de Atlassian. No necesitás una contraseña nueva.
          </p>

          {params?.error === 'wrong_site' && (
            <div style={{ background: '#FFF3CD', borderLeft: '3px solid #D4AF37', padding: '10px 14px', fontSize: 12, marginBottom: 16, color: '#856404', borderRadius: 3 }}>
              <strong>Sitio incorrecto.</strong> Elegiste <strong>{params.site}</strong>. Por favor seleccioná <strong>factoriamindata.atlassian.net</strong>.
            </div>
          )}

          {params?.error && params.error !== 'wrong_site' && (
            <div style={{ background: '#FBEEEE', borderLeft: '3px solid #E30613', padding: '10px 14px', fontSize: 12, marginBottom: 16, color: '#8E0000', borderRadius: 3 }}>
              Error al iniciar sesión. Por favor, intentá de nuevo.
            </div>
          )}

          <a href={authUrl} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', background: '#E30613', color: '#fff',
            fontWeight: 700, fontSize: 14, padding: '13px 20px',
            borderRadius: 3, textDecoration: 'none', border: 'none',
            transition: 'background 0.12s',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Iniciar sesión con Jira
          </a>

          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(212,175,55,0.4)' }}>
            <p style={{ fontSize: 11, color: '#999', margin: 0, textAlign: 'center' }}>
              Solo para usuarios de <strong>factoriamindata.atlassian.net</strong>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}