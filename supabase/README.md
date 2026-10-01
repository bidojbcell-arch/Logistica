# Preparación de Supabase

1. Inicia sesión con Supabase CLI desde un equipo autorizado y enlaza el proyecto usando su referencia:

   ```sh
   npx supabase login
   npx supabase link --project-ref wmnwewkbezepxbqnxpqy
   npx supabase db push
   ```

2. Abre `/mensajero/` y crea la primera cuenta con el correo que será administrador. Confirma el correo si Supabase lo solicita. El registro público siempre crea una cuenta `courier` pendiente; nunca acepta un rol enviado desde el navegador.

3. En Supabase SQL Editor, promueve exclusivamente esa cuenta. Sustituye el marcador por el correo elegido por el propietario:

   ```sql
   update public.profiles as p
   set role = 'admin',
       approval_status = 'approved',
       approved_at = now(),
       approved_by = null
   from auth.users as u
   where p.id = u.id
     and lower(u.email) = lower('CORREO_ADMINISTRADOR');
   ```

4. Entra al panel de administración en `/`. Las nuevas cuentas creadas desde `/mensajero/` aparecerán en “Aprobación de mensajeros”.

La migración restringe pedidos, productos, tarifas y ubicación con RLS. Las cuentas de mensajero solo ven pedidos que se les asignaron después de estar aprobadas. La función de seguimiento público devuelve únicamente campos de seguimiento y requiere un token aleatorio.

## Variables de Vercel

Configura URL y clave publicable (o la clave `anon` antigua) en Development, Preview y Production. Este proyecto acepta `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, además de las variables públicas de Next.js existentes. No añadas secretos de servidor o contraseña de base de datos al cliente. Tras cambiar variables, vuelve a desplegar.
