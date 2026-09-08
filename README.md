# Carga de Horas — Mindata

Sistema interno de imputación de horas que se integra directamente con **Jira Cloud** para que el equipo de Mindata pueda registrar, consultar y cargar sus horas de trabajo sin salir de una interfaz simple y rápida.

🔗 **Producción:** [imputacion-horas-md.vercel.app](https://imputacion-horas-md.vercel.app)

---

## ✨ Funcionalidades

- **Registro semanal** — tabla editable con vista de semana actual, dos semanas, últimos 30 o 60 días
- **Búsqueda global de tickets** — encontrá cualquier issue de Jira por clave o título sin salir de la app
- **Panel de proyectos y épicas** — navegación jerárquica con filtros por sociedad, asignación y estado
- **Consultar** — histórico de horas con KPIs, filtros y exportación a Excel
- **Carga masiva** — subí un Excel y cargá muchas horas en Jira de una sola vez
- **Timer integrado** — cronómetro en el header para medir tiempo en tiempo real
- **Vista mobile** — experiencia adaptada para cargar horas desde el celular

---

## 🛠️ Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Autenticación | Atlassian OAuth 2.0 (3LO) |
| Sesiones | iron-session + Upstash Redis |
| Hosting | Vercel |
| Excel | SheetJS (xlsx) |

---

## 🚀 Empezar en local

```bash
# Clonar el repositorio
git clone https://github.com/mindatapbi/imputacion-horas.git
cd imputacion-horas

# Instalar dependencias
npm install

# Copiar las variables de entorno
cp .env.example .env.local
# completar con tus credenciales

# Levantar el servidor de desarrollo
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

> ⚠️ Para que el login funcione en local, `http://localhost:3000/api/auth/callback` debe estar agregado como callback permitida en la app de Atlassian Developer Console.

---

## 🔑 Variables de entorno

| Variable | Descripción |
|---|---|
| `ATLASSIAN_CLIENT_ID` | Client ID de la app OAuth en Atlassian |
| `ATLASSIAN_CLIENT_SECRET` | Client Secret de la app OAuth |
| `ATLASSIAN_CALLBACK_URL` | URL de callback (debe coincidir con la registrada en Atlassian) |
| `ATLASSIAN_CLOUD_ID` | Cloud ID del sitio de Jira (`factoriamindata.atlassian.net`) |
| `IRON_SESSION_SECRET` | Secreto para firmar las cookies de sesión (mínimo 32 caracteres) |
| `KV_REST_API_URL` | URL de la instancia de Upstash Redis |
| `KV_REST_API_TOKEN` | Token de acceso a Upstash Redis |

---

## 📁 Estructura del proyecto

```
app/
├── page.tsx                    # Login
├── dashboard/page.tsx          # Vista Registro
├── timesheet/page.tsx          # Vista Consultar
├── upload/page.tsx             # Carga masiva (Excel)
└── api/
    ├── auth/
    │   ├── callback/route.ts   # OAuth callback
    │   ├── logout/route.ts     # Cierre de sesión
    │   └── me/route.ts         # Usuario actual
    └── jira/
        ├── issues/route.ts     # Proyectos, tickets, búsqueda
        ├── worklog/route.ts    # Carga de horas (POST batch)
        └── timesheet/route.ts  # Consulta/edición de worklogs

components/
└── AppHeader.tsx                # Header con navegación, timer y usuario

lib/
├── session.ts                   # Configuración de iron-session
└── redis.ts                     # Manejo de tokens OAuth (Upstash)
```

---

## 🔄 Flujo de despliegue

1. Trabajar en local con `npm run dev`
2. Commitear y pushear a `main`
3. Vercel deploya automáticamente al detectar el push

```bash
git add .
git commit -m "descripción del cambio"
git push mindata main
```

---

## 📄 Documentación adicional

- [Guía de uso para usuarios finales](./docs/instructivo_carga_horas.docx) — instructivo paso a paso de Registro, Consultar y Carga masiva

---

## 🏢 Mantenido por

Equipo de Desarrollo — **Mindata** · Uso interno
