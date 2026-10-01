# RutaRD Logística

Aplicación de logística multipágina compilada con TypeScript y Vite. La autenticación y los datos compartidos usan Supabase; la autorización de cada usuario depende de Row Level Security (RLS) en PostgreSQL.

## Desarrollo

```sh
npm install
npm run dev
npm run typecheck
npm run build
```

Duplica `.env.example` como `.env.local` para desarrollo. El frontend solo requiere la URL de Supabase y una clave publicable. En Vercel también puede leer `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` ya configuradas; solo se publican la URL y la clave publicable/anon.

Nunca configures `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` ni credenciales PostgreSQL como variables públicas de frontend. No hacen falta en el navegador.

## Supabase

El esquema inicial está en `supabase/migrations/`. Lee `supabase/README.md` para enlazar el proyecto, aplicar la migración y activar la primera cuenta administradora. Cada registro público crea una cuenta de mensajero pendiente; una cuenta de administrador aprobada puede aprobar o rechazar esas solicitudes.
