# Preparación de Supabase

1. Inicia sesión con Supabase CLI desde un equipo autorizado y enlaza el proyecto usando su referencia:

   ```sh
   npx supabase login
   npx supabase link --project-ref wmnwewkbezepxbqnxpqy
   npx supabase db push
   ```

2. Abre `/mensajero/` y registra `bidojbcell@gmail.com` para crear la cuenta inicial. Elige una contraseña propia y segura y confirma el correo si Supabase lo solicita. Los registros públicos siempre empiezan como mensajeros pendientes; el navegador nunca puede asignar el rol de administrador.

3. En Supabase SQL Editor, promueve esa cuenta inicial a administradora:

   ```sql
   update public.profiles as p
   set role = 'admin',
       approval_status = 'approved',
       approved_at = now(),
       approved_by = null
   from auth.users as u
   where p.id = u.id
     and lower(u.email) = lower('bidojbcell@gmail.com');
   ```

4. Entra al panel de administración en `/`. Las nuevas cuentas creadas desde `/mensajero/` aparecerán en “Aprobación de mensajeros” para que las apruebes o rechaces.

No se configura una contraseña genérica compartida. Al crear la cuenta inicial, el administrador establece su propia contraseña; después puede cambiarla desde el menú **AM → Cambiar contraseña**, confirmando primero su contraseña actual. Si la olvidó, usa **Olvidé mi contraseña** en el formulario para recibir un enlace de recuperación.

La migración restringe pedidos, productos, tarifas y ubicación con RLS. Las cuentas de mensajero solo ven pedidos que se les asignaron después de estar aprobadas. La función de seguimiento público devuelve únicamente campos de seguimiento y requiere un token aleatorio.

## Variables de Vercel

Configura URL y clave publicable (o la clave `anon` antigua) en Development, Preview y Production. Este proyecto acepta `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, además de las variables públicas de Next.js existentes. No añadas secretos de servidor o contraseña de base de datos al cliente. Tras cambiar variables, vuelve a desplegar.

En **Authentication → URL Configuration**, añade a Redirect URLs el origen del sitio desplegado y las rutas `/` y `/mensajero/`. La recuperación vuelve al mismo origen desde donde se solicitó y depende de que ese origen esté permitido.
