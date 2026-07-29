import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, sessionOptions } from "@/lib/session";
import { getToken, refreshAccessToken } from "@/lib/redis";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const params = await searchParams;

  if (session.user?.accountId && session.cloudId) {
    // Intentar obtener token válido, renovando si es necesario
    const token = await getToken(session.user.accountId) || 
                  await refreshAccessToken(session.user.accountId, session.cloudId);
    if (token) redirect("/dashboard");
    else session.destroy(); // Token expirado y no se pudo renovar — forzar login
  }

  // const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${process.env.ATLASSIAN_CLIENT_ID}&scope=read%3Ajira-user%20read%3Ajira-work%20write%3Ajira-work%20read%3Agroup%3Ajira&redirect_uri=${encodeURIComponent(process.env.ATLASSIAN_CALLBACK_URL!)}&response_type=code&prompt=consent`;
  const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${process.env.ATLASSIAN_CLIENT_ID}&scope=read%3Ajira-user%20read%3Ajira-work%20write%3Ajira-work&redirect_uri=${encodeURIComponent(process.env.ATLASSIAN_CALLBACK_URL!)}&response_type=code&prompt=consent&resource=ari:cloud:jira::site/${process.env.ATLASSIAN_CLOUD_ID}`;
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Imputación de Horas</h1>
          <p className="text-gray-500 mt-2">Registrá tus horas en Jira de forma simple y rápida</p>
        </div>

        {params?.error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            Error al iniciar sesión. Por favor, intentá de nuevo.
          </div>
        )}

        <a href={authUrl} className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
          Iniciar sesión con Jira
        </a>
        <p className="text-xs text-gray-400 mt-4">Usamos tu cuenta de Atlassian. No guardamos tu contraseña.</p>
      </div>
    </main>
  );
}