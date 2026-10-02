import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type AppRole = 'admin' | 'courier';
type Profile = {
  id: string;
  full_name: string;
  phone: string;
  role: AppRole;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

const requiredRole: AppRole = location.pathname.startsWith('/mensajero/') ? 'courier' : 'admin';
const shell = document.createElement('section');
shell.id = 'rutard-auth-gate';
shell.setAttribute('aria-live', 'polite');
shell.innerHTML = `
  <style>
    #rutard-auth-gate{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#06162e,#12345b 60%,#087d72);font-family:Inter,system-ui,sans-serif;color:#17243a}
    #rutard-auth-gate *{box-sizing:border-box} .auth-card{width:min(470px,100%);padding:30px;background:white;border-radius:20px;box-shadow:0 25px 80px #020d2066}
    .auth-brand{font-size:13px;font-weight:850;letter-spacing:.13em;color:#008b73}.auth-card h1{font-size:27px;margin:10px 0 7px}.auth-card p{color:#62718a;line-height:1.5;margin:0 0 20px}
    .auth-form{display:grid;gap:12px}.auth-form label{display:grid;gap:6px;font-size:13px;font-weight:700}.auth-form input{width:100%;border:1px solid #dbe2ec;border-radius:9px;padding:12px;font:inherit}.auth-form button,.auth-secondary{border:0;border-radius:9px;padding:12px;background:#00b894;color:#06352f;font:inherit;font-weight:800;cursor:pointer}
    .auth-secondary{background:#eef2f8;color:#17243a}.auth-switch{border:0;background:none;color:#2459b7;font:inherit;font-weight:700;cursor:pointer;padding:6px}.auth-error{min-height:20px;color:#a52b3a;font-size:13px}.auth-info{padding:12px;border-radius:9px;background:#e5fbf5;color:#087b67;font-size:14px;line-height:1.5}.auth-top-action{border:1px solid #e5eaf2;background:#fff;color:#17243a;padding:9px 12px;border-radius:8px;cursor:pointer}
    .account-menu .account-change-password{background:#eef2f8;color:#17243a}.account-password-dialog{width:min(440px,calc(100vw - 32px));border:0;border-radius:16px;padding:24px;box-shadow:0 24px 80px #020d2066;color:#17243a}.account-password-dialog::backdrop{background:#06162e99}.account-password-dialog h2{margin:0 0 7px}.account-password-dialog p{color:#62718a;line-height:1.45}.account-password-form{display:grid;gap:12px}.account-password-form label{display:grid;gap:6px;font-size:13px;font-weight:700}.account-password-form input{border:1px solid #dbe2ec;border-radius:8px;padding:11px;font:inherit}.account-password-actions{display:flex;justify-content:end;gap:8px;margin-top:6px}.account-password-actions button{padding:10px 12px;border:0;border-radius:8px;font-weight:700}.account-password-cancel{background:#eef2f8;color:#17243a}.account-password-submit{background:#00b894;color:#06352f}.account-password-error{min-height:18px;color:#a52b3a;font-size:13px}
    .approval-card{background:#fff;border:1px solid #e5eaf2;border-radius:13px;padding:18px;margin-bottom:14px}.approval-actions{display:flex;gap:8px}.approval-actions button{border:0;border-radius:8px;padding:8px 11px;cursor:pointer;font-weight:700}.approve-btn{background:#00b894;color:#06352f}.reject-btn{background:#feecef;color:#a52b3a}
  </style>
  <div class="auth-card"><div class="auth-brand">RUTARD · ACCESO</div><h1 id="authTitle">Iniciar sesión</h1><p id="authDescription">Ingresa para abrir tu panel de RutaRD.</p><div id="authContent"></div></div>`;
document.body.append(shell);

const content = shell.querySelector<HTMLElement>('#authContent')!;
const title = shell.querySelector<HTMLElement>('#authTitle')!;
const description = shell.querySelector<HTMLElement>('#authDescription')!;

function renderMessage(message: string, showLogout = false) {
  title.textContent = 'Acceso RutaRD';
  description.textContent = 'Tu panel está protegido por cuenta y permisos.';
  content.innerHTML = `<div class="auth-info">${message}</div>${showLogout ? '<button class="auth-secondary" id="authSignOut" style="width:100%;margin-top:12px">Cerrar sesión</button>' : ''}`;
  content.querySelector<HTMLButtonElement>('#authSignOut')?.addEventListener('click', () => void supabase?.auth.signOut());
}

function renderForms(mode: 'login' | 'register' = 'login', error = '') {
  const registering = mode === 'register';
  title.textContent = registering ? 'Crear cuenta de mensajero' : 'Iniciar sesión';
  description.textContent = registering
    ? 'Regístrate con tu usuario y contraseña. El administrador debe aprobar la cuenta antes de asignarte entregas.'
    : requiredRole === 'admin' ? 'Panel administrativo · ingresa con tu cuenta autorizada.' : 'Panel de mensajero · inicia sesión o solicita una cuenta.';
  content.innerHTML = `
    <form class="auth-form" id="authForm">
      ${registering ? '<label>Nombre completo<input name="fullName" autocomplete="name" required maxlength="100"></label><label>Teléfono / WhatsApp<input name="phone" type="tel" autocomplete="tel" required maxlength="30"></label>' : ''}
      <label>Correo electrónico<input name="email" type="email" autocomplete="username" required></label>
      <label>Contraseña<input name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="8" required></label>
      <div class="auth-error" id="authError" role="alert">${error}</div>
      <button type="submit">${registering ? 'Crear cuenta' : 'Entrar'}</button>
    </form>
    ${requiredRole === 'courier' ? `<button class="auth-switch" id="authToggle">${registering ? 'Ya tengo cuenta · Iniciar sesión' : '¿Nuevo mensajero? · Crear cuenta'}</button><a class="auth-switch" href="/" style="display:block;text-align:center;text-decoration:none">Acceso de administrador</a>` : '<a class="auth-switch" href="/mensajero/" style="display:block;text-align:center;text-decoration:none">¿Eres mensajero? Crear cuenta o iniciar sesión</a>'}`;

  content.querySelector<HTMLButtonElement>('#authToggle')?.addEventListener('click', () => renderForms(registering ? 'login' : 'register'));
  content.querySelector<HTMLFormElement>('#authForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const submit = content.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const error = content.querySelector<HTMLElement>('#authError')!;
    submit.disabled = true;
    submit.textContent = 'Procesando…';
    error.textContent = '';
    try {
      if (!supabase) throw new Error('Falta configurar la conexión de Supabase para este sitio.');
      if (registering) {
        const fullName = String(form.get('fullName') || '').trim();
        const phone = String(form.get('phone') || '').trim();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, phone } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          renderMessage('Revisa tu correo para confirmar la cuenta. Después podrás entrar; tu cuenta quedará pendiente de aprobación administrativa.');
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      await checkAccess();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : 'No se pudo completar el acceso.';
      submit.disabled = false;
      submit.textContent = registering ? 'Crear cuenta' : 'Entrar';
    }
  });
}

async function checkAccess(user?: User) {
  if (!supabase) {
    renderMessage('La conexión de Supabase no está configurada en este despliegue.');
    return;
  }
  const currentUser = user ?? (await supabase.auth.getUser()).data.user;
  if (!currentUser) {
    renderForms();
    return;
  }
  const { data, error } = await supabase.from('profiles').select('id,full_name,phone,role,approval_status,created_at').eq('id', currentUser.id).maybeSingle();
  if (error) {
    renderMessage('No se pudo consultar el perfil. Verifica que el esquema de RutaRD esté aplicado en Supabase. ' + error.message, true);
    return;
  }
  if (!data) {
    renderMessage('Tu cuenta aún no tiene un perfil de RutaRD. Contacta al administrador.', true);
    return;
  }
  const profile = data as Profile;
  if (profile.role === 'courier' && profile.approval_status !== 'approved') {
    renderMessage(profile.approval_status === 'rejected'
      ? 'La solicitud de mensajero no fue aprobada. Contacta al administrador si necesitas ayuda.'
      : 'Tu registro fue recibido. El administrador debe aprobar tu cuenta antes de entrar al panel de mensajero.', true);
    return;
  }
  if (profile.approval_status !== 'approved') {
    renderMessage('La cuenta no está habilitada. Contacta al administrador.', true);
    return;
  }
  if (profile.role !== requiredRole) {
    location.replace(profile.role === 'admin' ? '/' : '/mensajero/');
    return;
  }
  try {
    if (profile.role === 'admin') {
      const { hydrateAdminData } = await import('./main');
      await hydrateAdminData();
    } else {
      const { hydrateCourierData } = await import('./courier');
      await hydrateCourierData();
    }
  } catch (cause) {
    renderMessage('No se pudieron cargar los datos protegidos de Supabase. Verifica las migraciones y políticas RLS. ' + (cause instanceof Error ? cause.message : ''), true);
    return;
  }
  shell.remove();
  addSessionControls(currentUser, profile);
  if (profile.role === 'admin') addCourierApprovals();
}

function addSessionControls(user: User, profile: Profile) {
  const host = document.querySelector<HTMLElement>('.actions') || document.querySelector<HTMLElement>('.top') || document.body;
  const accountButton = document.querySelector<HTMLButtonElement>('#accountButton');
  const displayName = profile.full_name || user.email || 'Cuenta';
  if (!accountButton) return;
  accountButton.textContent = displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  accountButton.setAttribute('aria-label', `Cuenta de ${displayName}`);
  accountButton.title = displayName;

  const menu = document.createElement('div');
  menu.className = 'account-menu';
  menu.id = 'accountMenu';
  menu.hidden = true;
  menu.innerHTML = `<strong>${escapeText(displayName)}</strong><small>${profile.role === 'admin' ? 'Administrador' : 'Mensajero'} · ${escapeText(user.email || '')}</small><button type="button" class="account-change-password" id="accountChangePassword">Cambiar contraseña</button><button type="button" id="accountSignOut">Cerrar sesión</button>`;
  host.append(menu);

  const passwordDialog = document.createElement('dialog');
  passwordDialog.className = 'account-password-dialog';
  passwordDialog.setAttribute('aria-labelledby', 'accountPasswordTitle');
  passwordDialog.innerHTML = `<form class="account-password-form" id="accountPasswordForm"><h2 id="accountPasswordTitle">Cambiar contraseña</h2><p>Confirma tu contraseña actual y escribe una nueva de al menos 8 caracteres.</p><label>Contraseña actual<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="newPassword" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirmar nueva contraseña<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label><div class="account-password-error" id="accountPasswordError" role="alert"></div><div class="account-password-actions"><button type="button" class="account-password-cancel" id="cancelPasswordChange">Cancelar</button><button type="submit" class="account-password-submit">Actualizar contraseña</button></div></form>`;
  document.body.append(passwordDialog);
  menu.querySelector<HTMLButtonElement>('#accountChangePassword')?.addEventListener('click', () => {
    menu.hidden = true;
    accountButton.setAttribute('aria-expanded', 'false');
    passwordDialog.showModal();
  });
  passwordDialog.querySelector<HTMLButtonElement>('#cancelPasswordChange')?.addEventListener('click', () => passwordDialog.close());
  passwordDialog.querySelector<HTMLFormElement>('#accountPasswordForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const currentPassword = String(form.get('currentPassword') || '');
    const newPassword = String(form.get('newPassword') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    const error = passwordDialog.querySelector<HTMLElement>('#accountPasswordError')!;
    const submit = passwordDialog.querySelector<HTMLButtonElement>('.account-password-submit')!;
    error.textContent = '';
    if (newPassword !== confirmPassword) {
      error.textContent = 'Las contraseñas nuevas no coinciden.';
      return;
    }
    if (!user.email) {
      error.textContent = 'La cuenta no tiene correo para verificar la contraseña actual.';
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Actualizando…';
    try {
      const { error: verifyError } = await supabase!.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verifyError) throw new Error('La contraseña actual no es correcta.');
      const { error: updateError } = await supabase!.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      passwordDialog.close();
      (passwordDialog.querySelector<HTMLFormElement>('#accountPasswordForm')!).reset();
      window.alert('Contraseña actualizada correctamente.');
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : 'No se pudo cambiar la contraseña.';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Actualizar contraseña';
    }
  });

  accountButton.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    accountButton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', event => {
    if (!menu.hidden && !host.contains(event.target as Node)) {
      menu.hidden = true;
      accountButton.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !passwordDialog.open) {
      menu.hidden = true;
      accountButton.setAttribute('aria-expanded', 'false');
      accountButton.focus();
    }
  });
  menu.querySelector<HTMLButtonElement>('#accountSignOut')?.addEventListener('click', async () => {
    await supabase?.auth.signOut();
    location.reload();
  });
}

function addCourierApprovals() {
  const nav = document.querySelector('.nav');
  const main = document.querySelector('.content');
  if (!nav || !main || nav.querySelector('[data-page="courier-approvals"]')) return;
  const navButton = document.createElement('button');
  navButton.dataset.page = 'courier-approvals';
  navButton.textContent = '✓ Aprobación de mensajeros';
  navButton.addEventListener('click', () => {
    nav.querySelectorAll('[data-page]').forEach(button => button.classList.remove('active'));
    navButton.classList.add('active');
    main.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    approvalPage.classList.add('active');
    const crumb = document.querySelector<HTMLElement>('#crumb');
    if (crumb) crumb.textContent = 'Aprobación de mensajeros';
    void loadPendingCouriers();
  });
  nav.append(navButton);
  const approvalPage = document.createElement('section');
  approvalPage.className = 'page';
  approvalPage.id = 'courier-approvals';
  approvalPage.innerHTML = '<div class="heading"><div><h1>Solicitudes de mensajero</h1><p>Aprueba o rechaza las cuentas nuevas antes de darles acceso al panel.</p></div><button class="filter" id="refreshCourierApprovals">↻ Actualizar</button></div><div id="pendingCouriers"><div class="approval-card">Cargando solicitudes…</div></div>';
  main.append(approvalPage);
  approvalPage.querySelector('#refreshCourierApprovals')?.addEventListener('click', () => void loadPendingCouriers());
  async function loadPendingCouriers() {
    const target = approvalPage.querySelector<HTMLElement>('#pendingCouriers')!;
    if (!supabase) return;
    const { data, error } = await supabase.from('profiles').select('id,full_name,phone,role,approval_status,created_at').eq('role', 'courier').eq('approval_status', 'pending').order('created_at');
    if (error) {
      target.textContent = 'No se pudieron cargar las solicitudes: ' + error.message;
      return;
    }
    if (!data?.length) {
      target.innerHTML = '<div class="approval-card">No hay solicitudes pendientes.</div>';
      return;
    }
    target.innerHTML = data.map(profile => `<article class="approval-card"><h2>${escapeText(profile.full_name || 'Mensajero')}</h2><p>${escapeText(profile.phone || 'Sin teléfono')} · ${new Date(profile.created_at).toLocaleDateString('es-DO')}</p><div class="approval-actions"><button class="approve-btn" data-approve="${profile.id}">Aprobar</button><button class="reject-btn" data-reject="${profile.id}">Rechazar</button></div></article>`).join('');
    target.querySelectorAll<HTMLButtonElement>('[data-approve]').forEach(button => button.addEventListener('click', () => void decide(button.dataset.approve!, true)));
    target.querySelectorAll<HTMLButtonElement>('[data-reject]').forEach(button => button.addEventListener('click', () => void decide(button.dataset.reject!, false)));
  }
  async function decide(id: string, approve: boolean) {
    const { error } = await supabase!.rpc('approve_courier', { p_courier_id: id, p_approve: approve });
    if (error) {
      window.alert('No se pudo actualizar la cuenta: ' + error.message);
      return;
    }
    await loadPendingCouriers();
  }
}

function escapeText(value: unknown) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

if (!supabase) renderMessage('Falta configurar las variables públicas de Supabase.');
else {
  renderForms();
  void checkAccess();
}

export {};
