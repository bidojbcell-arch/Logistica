import { supabase } from './lib/supabase';

type CourierStop = {
  id: string;
  trackingToken: string;
  client: string;
  phone: string;
  address: string;
  product: string;
  quantity: number;
  unitPrice: number;
  delivery: number;
  zone: string;
  status: string;
  location: string;
};

const courierStatuses = ['Pendiente', 'En ruta', 'De camino al cliente', 'Entregado', 'No entregado'] as const;
type CourierStatus = typeof courierStatuses[number];

const getEl = (id: string): HTMLElement => document.getElementById(id)!;
let courierStart: { lat: number; lng: number } | null = null;
let availableStops: CourierStop[] = [];
let routeStops: CourierStop[] = [];
let routeStorageKey = '';
let locationWatchId: number | undefined;
let lastLocationWrite = 0;
let currentCourierId = '';
const savingStatus = new Set<string>();
let courierProducts: Array<{ id: string; name: string }> = [];
let inventoryRealtimeStarted = false;

function escapeHTML(value: unknown) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function money(value: number) {
  return `RD$${Number(value || 0).toLocaleString('es-DO')}`;
}

function saveRoute() {
  if (!routeStorageKey) return;
  try {
    localStorage.setItem(routeStorageKey, JSON.stringify(routeStops.map(stop => stop.id)));
  } catch { /* Route order is a device preference; Supabase remains the source of order data. */ }
}

function drawRoute() {
  const destinations = routeStops.map(stop => stop.location).filter(Boolean);
  const map = getEl('courierMap') as HTMLIFrameElement;
  if (!destinations.length) {
    map.src = 'https://maps.google.com/maps?q=Santo%20Domingo%2C%20Rep%C3%BAblica%20Dominicana&z=12&hl=es&output=embed';
    return;
  }

  const daddr = destinations.map(encodeURIComponent).join('+to:');
  const origin = courierStart ? `saddr=${courierStart.lat}%2C${courierStart.lng}&` : '';
  map.src = `https://maps.google.com/maps?${origin}daddr=${daddr}&dirflg=d&hl=es&output=embed`;
}

function renderStops() {
  const routeList = getEl('routeStops');
  if (!routeStops.length) {
    routeList.innerHTML = '<div class="notice">No tienes entregas activas asignadas. Los pedidos que te asigne el administrador aparecerán aquí.</div>';
    drawRoute();
    return;
  }

  routeList.innerHTML = routeStops.map((stop, index) => {
    const destination = encodeURIComponent(stop.location);
    const waze = `https://waze.com/ul?q=${destination}&navigate=yes`;
    const trackingUrl = `${location.origin}/seguimiento/?token=${encodeURIComponent(stop.trackingToken)}`;
    const trackingMessage = encodeURIComponent(`Hola ${stop.client}, puedes darle seguimiento a tu pedido #${stop.id} aquí: ${trackingUrl}`);
    const phoneActions = stop.phone
      ? `<a class="btn primary" href="https://wa.me/${stop.phone}?text=${trackingMessage}" target="_blank" rel="noopener noreferrer">Enviar seguimiento por WhatsApp</a><a class="btn whatsapp" href="https://wa.me/${stop.phone}?text=${encodeURIComponent(`Hola ${stop.client}, voy hacia tu dirección con el pedido #${stop.id}.`)}" target="_blank" rel="noopener noreferrer">WhatsApp cliente</a><a class="btn" href="tel:+${stop.phone}">Llamar</a>`
      : '<span class="muted">El cliente no tiene teléfono registrado.</span>';

    const statusOptions = courierStatuses.map(status => `<option value="${status}" ${stop.status === status ? 'selected' : ''}>${status}</option>`).join('');
    return `<article class="stop"><div class="stop-head"><b>${index + 1}. ${escapeHTML(stop.client)} · #${escapeHTML(stop.id)}</b><span class="tag">${escapeHTML(stop.status)}</span><button class="btn small" aria-label="Mover ${escapeHTML(stop.client)} hacia arriba" onclick="moveStop(${index},-1)" ${index === 0 ? 'disabled' : ''}>↑</button><button class="btn small" aria-label="Mover ${escapeHTML(stop.client)} hacia abajo" onclick="moveStop(${index},1)" ${index === routeStops.length - 1 ? 'disabled' : ''}>↓</button></div><p><strong>Dirección:</strong> ${escapeHTML(stop.address || stop.location)}<br><strong>Zona:</strong> ${escapeHTML(stop.zone || 'Sin zona registrada')}<br><strong>WhatsApp:</strong> ${escapeHTML(stop.phone || 'No registrado')}<br><strong>Producto:</strong> ${escapeHTML(stop.product)} × ${stop.quantity} · ${money(stop.unitPrice)} c/u<br><strong>Delivery:</strong> ${money(stop.delivery)}</p><div class="status-editor"><label for="status-${escapeHTML(stop.id)}">Estado del pedido</label><select id="status-${escapeHTML(stop.id)}" ${savingStatus.has(stop.id) ? 'disabled' : ''}>${statusOptions}</select><button class="btn primary" onclick="saveCourierStatus('${escapeHTML(stop.id)}')" ${savingStatus.has(stop.id) ? 'disabled' : ''}>${savingStatus.has(stop.id) ? 'Guardando…' : 'Guardar estado'}</button></div><div class="actions">${phoneActions}<a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${destination}" target="_blank" rel="noopener noreferrer">Google Maps</a><a class="btn" href="${waze}" target="_blank" rel="noopener noreferrer">Waze</a></div></article>`;
  }).join('');

  drawRoute();
}

async function saveCourierStatus(orderId: string) {
  if (!supabase || !currentCourierId || savingStatus.has(orderId)) return;
  const select = document.getElementById(`status-${orderId}`) as HTMLSelectElement | null;
  if (!select || !courierStatuses.includes(select.value as CourierStatus)) return;
  const stop = routeStops.find(item => item.id === orderId);
  if (!stop) return;
  const nextStatus = select.value as CourierStatus;
  if (nextStatus === stop.status) return;
  savingStatus.add(orderId);
  renderStops();
  const saveStatus = (status: string) => supabase!.from('orders')
    .update({ status })
    .eq('id', Number(orderId))
    .eq('courier_id', currentCourierId)
    .select('id')
    .maybeSingle();
  let { data, error } = await saveStatus(nextStatus);
  // Older databases still constrain these two states to their original labels.
  if (error?.code === '23514' && (nextStatus === 'En ruta' || nextStatus === 'De camino al cliente')) {
    ({ data, error } = await saveStatus(nextStatus === 'En ruta' ? 'En camino' : 'Llegando'));
  }
  savingStatus.delete(orderId);
  if (error || !data) {
    console.error('No se pudo actualizar el estado del pedido', error);
    window.alert(error?.message || 'No se pudo guardar el estado. Actualiza la página e inténtalo de nuevo.');
    renderStops();
    return;
  }
  stop.status = nextStatus;
  if (nextStatus === 'Entregado' || nextStatus === 'No entregado') {
    availableStops = availableStops.filter(item => item.id !== orderId);
    routeStops = routeStops.filter(item => item.id !== orderId);
    saveRoute();
    const remaining = availableStops.length;
    getEl('courierSummary').textContent = `${remaining} entrega${remaining === 1 ? '' : 's'} activa${remaining === 1 ? '' : 's'} asignada${remaining === 1 ? '' : 's'} · Santo Domingo`;
    getEl('courierStatus').textContent = remaining ? 'Pedidos asignados' : 'Sin entregas activas';
  }
  renderStops();
  if (nextStatus === 'Entregado') await loadCourierInventory();
}

function inventoryStateLabel(status: string) {
  return status === 'pending' ? 'Pendiente de aprobación' : status === 'approved' ? 'Aprobado' : 'Rechazado';
}

async function loadCourierInventory() {
  if (!supabase || !currentCourierId) return;
  const target = document.getElementById('courierInventory');
  if (!target) return;
  const [stockResult, requestResult, deliveryResult, productResult] = await Promise.all([
    supabase.from('courier_inventory').select('product_id,quantity_assigned,quantity_available,quantity_delivered,updated_at').eq('courier_id', currentCourierId).order('updated_at', { ascending: false }),
    supabase.from('inventory_requests').select('id,product_id,quantity,status,requested_at').eq('courier_id', currentCourierId).order('requested_at', { ascending: false }).limit(10),
    supabase.from('inventory_deliveries').select('id,order_id,product_id,quantity,status,delivered_at').eq('courier_id', currentCourierId).order('delivered_at', { ascending: false }).limit(10),
    supabase.from('products').select('id,name').eq('is_active', true).order('name'),
  ]);
  const error = stockResult.error || requestResult.error || deliveryResult.error || productResult.error;
  if (error) {
    target.innerHTML = `<div class="notice">No se pudo cargar el inventario: ${escapeHTML(error.message)}</div>`;
    return;
  }
  courierProducts = (productResult.data || []).map(product => ({ id: product.id, name: product.name }));
  const productName = (id: string) => courierProducts.find(product => product.id === id)?.name || 'Producto del catálogo';
  const stockRows = stockResult.data || [];
  const requestRows = requestResult.data || [];
  const deliveryRows = deliveryResult.data || [];
  target.innerHTML = `<style>
    .courier-inventory-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.courier-inventory-block{border:1px solid #e5eaf2;border-radius:11px;padding:14px;min-width:0}.courier-inventory-block h3{margin:0 0 10px;font-size:15px}.inventory-line{padding:10px 0;border-top:1px solid #edf0f5;font-size:13px;line-height:1.5}.inventory-line:first-of-type{border-top:0}.inventory-line small{color:#62718a}.inventory-request-form{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin:10px 0 14px}.inventory-request-form label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#62718a}.inventory-request-form select,.inventory-request-form input{max-width:100%;border:1px solid #d6deea;border-radius:8px;background:white;padding:9px;color:#17243a;font:inherit}.inventory-request-form select{min-width:180px}@media(max-width:720px){.courier-inventory-grid{grid-template-columns:1fr}}
  </style><form class="inventory-request-form" id="inventoryRequestForm"><label>Producto<select name="product_id" required>${courierProducts.map(product => `<option value="${escapeHTML(product.id)}">${escapeHTML(product.name)}</option>`).join('')}</select></label><label>Cantidad<input name="quantity" type="number" min="1" step="1" value="1" required></label><button class="btn primary" type="submit" ${courierProducts.length ? '' : 'disabled'}>Solicitar al administrador</button></form><div class="courier-inventory-grid"><section class="courier-inventory-block"><h3>Existencias asignadas</h3>${stockRows.map(row => `<div class="inventory-line"><strong>${escapeHTML(productName(row.product_id))}</strong><br>Disponible: <b>${row.quantity_available}</b> · Asignado: ${row.quantity_assigned} · Entregado: ${row.quantity_delivered}</div>`).join('') || '<div class="inventory-line">Todavía no tienes productos asignados.</div>'}</section><section class="courier-inventory-block"><h3>Solicitudes y entregas</h3>${requestRows.map(row => `<div class="inventory-line">Solicitud: <strong>${escapeHTML(productName(row.product_id))} × ${row.quantity}</strong><br><small>${inventoryStateLabel(row.status)} · ${new Date(row.requested_at).toLocaleString('es-DO')}</small></div>`).join('')}${deliveryRows.map(row => `<div class="inventory-line">Pedido #${row.order_id}: <strong>${escapeHTML(productName(row.product_id))} × ${row.quantity}</strong><br><small>Entrega ${inventoryStateLabel(row.status).toLocaleLowerCase('es-DO')} · ${new Date(row.delivered_at).toLocaleString('es-DO')}</small></div>`).join('')}${requestRows.length || deliveryRows.length ? '' : '<div class="inventory-line">Aún no tienes solicitudes ni entregas para revisar.</div>'}</section></div>`;
  target.querySelector<HTMLFormElement>('#inventoryRequestForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const productId = String(values.get('product_id') || '');
    const quantity = Math.floor(Number(values.get('quantity')));
    if (!courierProducts.some(product => product.id === productId) || quantity < 1) return;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    button.textContent = 'Enviando…';
    const { error: requestError } = await supabase!.from('inventory_requests').insert({ courier_id: currentCourierId, product_id: productId, quantity });
    if (requestError) {
      window.alert('No se pudo enviar la solicitud: ' + requestError.message);
      button.disabled = false;
      button.textContent = 'Solicitar al administrador';
      return;
    }
    await loadCourierInventory();
  });
}

function moveStop(index: number, direction: number) {
  const destination = index + direction;
  if (destination < 0 || destination >= routeStops.length) return;
  [routeStops[index], routeStops[destination]] = [routeStops[destination], routeStops[index]];
  saveRoute();
  renderStops();
}

function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (value: number) => value * Math.PI / 180;
  const lat = rad(b.lat - a.lat);
  const lng = rad(b.lng - a.lng);
  const x = Math.sin(lat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function sortNearest() {
  // Addresses alone do not provide coordinates, so keep their current sequence intact.
  if (!courierStart || routeStops.length < 2) return;
  routeStops = [...routeStops].sort((a, b) => {
    const coords = (value: string) => value.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    const aMatch = coords(a.location);
    const bMatch = coords(b.location);
    if (!aMatch || !bMatch) return 0;
    return distance(courierStart, { lat: Number(aMatch[1]), lng: Number(aMatch[2]) })
      - distance(courierStart, { lat: Number(bMatch[1]), lng: Number(bMatch[2]) });
  });
  saveRoute();
  renderStops();
}

function resetRoute() {
  routeStops = [...availableStops];
  saveRoute();
  renderStops();
}

export async function hydrateCourierData() {
  if (!supabase) return;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return;
  currentCourierId = user.id;

  const { data, error } = await supabase.from('orders')
    .select('id,tracking_token,customer_name,customer_phone,address,map_link,product_name,quantity,unit_price,delivery_fee,zone_name,status,created_at')
    .eq('courier_id', user.id)
    .order('created_at');
  if (error) throw error;

  availableStops = (data || [])
    .filter(order => !['Entregado', 'Cancelado', 'No entregado'].includes(order.status))
    .map(order => ({
      id: String(order.id),
      trackingToken: order.tracking_token,
      client: order.customer_name || 'Cliente',
      phone: String(order.customer_phone || '').replace(/\D/g, ''),
      address: order.address || '',
      product: order.product_name || 'Producto no especificado',
      quantity: Number(order.quantity) || 1,
      unitPrice: Number(order.unit_price) || 0,
      delivery: Number(order.delivery_fee) || 0,
      zone: order.zone_name || '',
      status: normalizeCourierStatus(order.status),
      location: order.address || order.map_link || '',
    }));

  routeStorageKey = `rutard_courier_route_${user.id}`;
  const savedIds = (() => {
    try { return JSON.parse(localStorage.getItem(routeStorageKey) || '[]'); }
    catch { return []; }
  })();
  routeStops = Array.isArray(savedIds)
    ? savedIds.map(id => availableStops.find(stop => stop.id === String(id))).filter(Boolean)
      .concat(availableStops.filter(stop => !savedIds.includes(stop.id)))
    : [...availableStops];

  const name = String(user.user_metadata?.full_name || user.email || 'Mensajero');
  getEl('courierName').textContent = name;
  getEl('courierInitials').textContent = name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
  getEl('courierSummary').textContent = `${availableStops.length} entrega${availableStops.length === 1 ? '' : 's'} activa${availableStops.length === 1 ? '' : 's'} asignada${availableStops.length === 1 ? '' : 's'} · Santo Domingo`;
  getEl('courierStatus').textContent = availableStops.length ? 'Pedidos asignados' : 'Sin entregas activas';

  saveRoute();
  renderStops();
  await loadCourierInventory();
  if (!inventoryRealtimeStarted && supabase) {
    inventoryRealtimeStarted = true;
    supabase.channel(`rutard-courier-inventory-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_inventory', filter: `courier_id=eq.${user.id}` }, () => void loadCourierInventory())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_requests', filter: `courier_id=eq.${user.id}` }, () => void loadCourierInventory())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_deliveries', filter: `courier_id=eq.${user.id}` }, () => void loadCourierInventory())
      .subscribe();
    window.setInterval(() => {
      if (!document.hidden) void loadCourierInventory();
    }, 20000);
  }
  startLocationBroadcast(user.id);
}

function normalizeCourierStatus(status: string): CourierStatus {
  if (status === 'En camino') return 'En ruta';
  if (status === 'Llegando') return 'De camino al cliente';
  if (status === 'Asignado' || !courierStatuses.includes(status as CourierStatus)) return 'Pendiente';
  return status as CourierStatus;
}

function startLocationBroadcast(courierId: string) {
  if (!navigator.geolocation || locationWatchId !== undefined) return;
  locationWatchId = navigator.geolocation.watchPosition(position => {
    const now = Date.now();
    courierStart = { lat: position.coords.latitude, lng: position.coords.longitude };
    drawRoute();
    if (now - lastLocationWrite < 15000) return;
    lastLocationWrite = now;
    void supabase?.from('courier_locations').upsert({
      courier_id: courierId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_meters: position.coords.accuracy,
      recorded_at: new Date(position.timestamp).toISOString(),
    }, { onConflict: 'courier_id' }).then(({ error }) => {
      if (error) console.error('No se pudo compartir la ubicación', error);
    });
  }, error => console.warn('Ubicación no disponible:', error.message), {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 20000,
  });
}

renderStops();
Object.assign(window, { sortNearest, resetRoute, moveStop, saveCourierStatus });
