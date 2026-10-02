import { supabase } from './lib/supabase';

type Courier = { id: string; full_name: string; approval_status: string };
type Product = { id: string; name: string; is_active: boolean };

function escapeHTML(value: unknown) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function statusLabel(status: string) {
  return status === 'pending' ? 'Pendiente' : status === 'approved' ? 'Aprobado' : 'Rechazado';
}

export function mountAdminInventory() {
  if (!supabase) return;
  const nav = document.querySelector<HTMLElement>('.nav');
  const main = document.querySelector<HTMLElement>('.content');
  if (!nav || !main || nav.querySelector('[data-page="inventory-management"]')) return;

  const button = document.createElement('button');
  button.dataset.page = 'inventory-management';
  button.textContent = '▣ Inventario';
  nav.append(button);

  const page = document.createElement('section');
  page.id = 'inventory-management';
  page.className = 'page';
  page.innerHTML = `<style>
    #inventory-management .inventory-layout{display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,1.2fr);gap:18px;align-items:start}
    #inventory-management .inventory-panel{background:#fff;border:1px solid #e5eaf2;border-radius:13px;padding:18px;margin-bottom:16px;box-shadow:0 10px 30px rgba(15,35,64,.05)}
    #inventory-management .inventory-panel h2{font-size:16px;margin:0 0 13px}#inventory-management .inventory-form{display:grid;gap:11px}
    #inventory-management .inventory-form label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#62718a}
    #inventory-management .inventory-form input,#inventory-management .inventory-form select{width:100%;padding:10px;border:1px solid #e5eaf2;border-radius:8px;font:inherit;color:#17243a;background:#fff}
    #inventory-management .inventory-row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 0;border-top:1px solid #edf0f5;font-size:13px}
    #inventory-management .inventory-row:first-of-type{border-top:0}#inventory-management .inventory-row p{margin:4px 0 0;color:#62718a;line-height:1.5}
    #inventory-management .inventory-actions{display:flex;gap:7px;flex-wrap:wrap}.inventory-state{display:inline-block;background:#fff4dc;color:#9a5c00;padding:4px 8px;border-radius:20px;font-size:11px;font-weight:700}
    #inventory-management .inventory-state.approved{background:#e5fbf5;color:#087b67}#inventory-management .inventory-state.rejected{background:#feecef;color:#a52b3a}
    #inventory-management .order-state{display:inline-block;padding:5px 9px;border-radius:20px;font-size:11px;font-weight:800}.order-state.delivered{background:#d9f8ed;color:#087b67}.order-state.failed{background:#feecef;color:#a52b3a}
    #inventory-management .inventory-approve,#inventory-management .inventory-reject{border:0;border-radius:8px;padding:8px 10px;font-weight:700;cursor:pointer}
    #inventory-management .inventory-approve{background:#00b894;color:#06352f}#inventory-management .inventory-reject{background:#feecef;color:#a52b3a}
    #inventory-management .inventory-empty{padding:13px;border-radius:9px;background:#f4f7fb;color:#62718a;font-size:13px}
    @media(max-width:900px){#inventory-management .inventory-layout{grid-template-columns:1fr}}@media(max-width:560px){#inventory-management .inventory-row{align-items:flex-start;flex-direction:column}}
  </style><div class="heading"><div><h1>Inventario de mensajeros</h1><p>Asigna existencias, revisa cantidades solicitadas y aprueba lo entregado. Se actualiza automáticamente.</p></div><button class="filter" id="refreshInventory">↻ Actualizar</button></div><div class="inventory-layout"><div><section class="inventory-panel"><h2>Asignar inventario</h2><form class="inventory-form" id="assignInventoryForm"><label>Mensajero aprobado<select name="courier_id" required></select></label><label>Producto<select name="product_id" required></select></label><label>Cantidad a asignar<input name="quantity" type="number" min="1" step="1" value="1" required></label><button class="primary" type="submit">Asignar unidades</button></form></section><section class="inventory-panel"><h2>Existencias por mensajero</h2><div id="inventoryStock"><div class="inventory-empty">Cargando inventario…</div></div></section></div><div><section class="inventory-panel"><h2>Solicitudes de inventario</h2><div id="inventoryRequests"><div class="inventory-empty">Cargando solicitudes…</div></div></section><section class="inventory-panel"><h2>Estado de las entregas</h2><p style="color:#62718a;font-size:12px;margin:-5px 0 10px">No entregado se marca en rojo; entregado, en verde. Este panel se actualiza solo.</p><div id="inventoryOrderStatuses"><div class="inventory-empty">Cargando estados…</div></div></section><section class="inventory-panel"><h2>Entregas de inventario para aprobación</h2><div id="inventoryDeliveries"><div class="inventory-empty">Cargando entregas…</div></div></section></div></div>`;
  main.append(page);

  let realtimeDebounce: number | undefined;
  const refreshIfOpen = () => {
    if (document.hidden || !page.classList.contains('active')) return;
    if (realtimeDebounce !== undefined) window.clearTimeout(realtimeDebounce);
    realtimeDebounce = window.setTimeout(() => void loadInventory(), 350);
  };
  supabase.channel('rutard-admin-inventory')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshIfOpen)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_requests' }, refreshIfOpen)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_deliveries' }, refreshIfOpen)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_inventory' }, refreshIfOpen)
    .subscribe();
  window.setInterval(refreshIfOpen, 15000);
  document.addEventListener('visibilitychange', refreshIfOpen);

  button.addEventListener('click', () => {
    nav.querySelectorAll('[data-page]').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    main.querySelectorAll('.page').forEach(item => item.classList.remove('active'));
    page.classList.add('active');
    const crumb = document.querySelector<HTMLElement>('#crumb');
    if (crumb) crumb.textContent = 'Inventario';
    void loadInventory();
  });
  page.querySelector<HTMLButtonElement>('#refreshInventory')?.addEventListener('click', () => void loadInventory());

  async function loadInventory() {
    const [couriersResult, productsResult, stockResult, requestsResult, deliveriesResult, ordersResult] = await Promise.all([
      supabase!.from('profiles').select('id,full_name,approval_status').eq('role', 'courier').order('full_name'),
      supabase!.from('products').select('id,name,is_active').order('name'),
      supabase!.from('courier_inventory').select('courier_id,product_id,quantity_assigned,quantity_available,quantity_delivered').order('updated_at', { ascending: false }),
      supabase!.from('inventory_requests').select('id,courier_id,product_id,quantity,status,requested_at,reviewed_at').order('requested_at', { ascending: false }).limit(100),
      supabase!.from('inventory_deliveries').select('id,order_id,courier_id,product_id,quantity,status,delivered_at,reviewed_at').order('delivered_at', { ascending: false }).limit(100),
      supabase!.from('orders').select('id,courier_name,product_name,quantity,status,created_at,updated_at').in('status', ['Entregado', 'No entregado']).order('updated_at', { ascending: false }).limit(100),
    ]);
    const failure = couriersResult.error || productsResult.error || stockResult.error || requestsResult.error || deliveriesResult.error || ordersResult.error;
    if (failure) {
      page.querySelector('#inventoryStock')!.innerHTML = `<div class="inventory-empty">No se pudo cargar el módulo: ${escapeHTML(failure.message)}. Verifica que la migración de inventario esté aplicada en Supabase.</div>`;
      return;
    }

    const couriers = (couriersResult.data || []) as Courier[];
    const products = (productsResult.data || []) as Product[];
    const courierName = (id: string) => couriers.find(row => row.id === id)?.full_name || 'Mensajero';
    const productName = (id: string) => products.find(row => row.id === id)?.name || 'Producto';
    const approvedCouriers = couriers.filter(row => row.approval_status === 'approved');
    const courierSelect = page.querySelector<HTMLSelectElement>('[name="courier_id"]')!;
    const productSelect = page.querySelector<HTMLSelectElement>('[name="product_id"]')!;
    courierSelect.innerHTML = approvedCouriers.map(row => `<option value="${escapeHTML(row.id)}">${escapeHTML(row.full_name || 'Mensajero')}</option>`).join('');
    productSelect.innerHTML = products.filter(row => row.is_active).map(row => `<option value="${escapeHTML(row.id)}">${escapeHTML(row.name)}</option>`).join('');
    page.querySelector<HTMLButtonElement>('#assignInventoryForm button[type="submit"]')!.disabled = !approvedCouriers.length || !products.some(row => row.is_active);

    page.querySelector<HTMLElement>('#inventoryStock')!.innerHTML = (stockResult.data || []).map(row => `<div class="inventory-row"><div><strong>${escapeHTML(courierName(row.courier_id))} · ${escapeHTML(productName(row.product_id))}</strong><p>Disponible: <b>${row.quantity_available}</b> · Asignado: ${row.quantity_assigned} · Entregado: ${row.quantity_delivered}</p></div></div>`).join('') || '<div class="inventory-empty">Aún no se ha asignado inventario.</div>';

    page.querySelector<HTMLElement>('#inventoryRequests')!.innerHTML = (requestsResult.data || []).map(row => `<div class="inventory-row"><div><strong>${escapeHTML(courierName(row.courier_id))} solicita ${row.quantity} · ${escapeHTML(productName(row.product_id))}</strong><p>${new Date(row.requested_at).toLocaleString('es-DO')}</p><span class="inventory-state ${row.status}">${statusLabel(row.status)}</span></div>${row.status === 'pending' ? `<div class="inventory-actions"><button class="inventory-approve" data-request="${escapeHTML(row.id)}" data-approve="true">Aprobar y asignar</button><button class="inventory-reject" data-request="${escapeHTML(row.id)}" data-approve="false">Rechazar</button></div>` : ''}</div>`).join('') || '<div class="inventory-empty">No hay solicitudes de inventario.</div>';

    page.querySelector<HTMLElement>('#inventoryOrderStatuses')!.innerHTML = (ordersResult.data || []).map(row => {
      const delivered = row.status === 'Entregado';
      return `<div class="inventory-row"><div><strong>Pedido #${row.id} · ${escapeHTML(row.courier_name || 'Sin mensajero')}</strong><p>${escapeHTML(row.product_name || 'Producto')} × ${row.quantity} · ${new Date(row.updated_at || row.created_at).toLocaleString('es-DO')}</p></div><span class="order-state ${delivered ? 'delivered' : 'failed'}">${delivered ? 'ENTREGADO' : 'NO ENTREGADO'}</span></div>`;
    }).join('') || '<div class="inventory-empty">Aún no hay pedidos entregados o no entregados.</div>';

    page.querySelector<HTMLElement>('#inventoryDeliveries')!.innerHTML = (deliveriesResult.data || []).map(row => `<div class="inventory-row"><div><strong>Pedido #${row.order_id} · ${escapeHTML(courierName(row.courier_id))}</strong><p>${escapeHTML(productName(row.product_id))} × ${row.quantity} · ${new Date(row.delivered_at).toLocaleString('es-DO')}</p><span class="inventory-state ${row.status}">${statusLabel(row.status)}</span></div>${row.status === 'pending' ? `<div class="inventory-actions"><button class="inventory-approve" data-delivery="${escapeHTML(row.id)}" data-approve="true">Aprobar entregado</button><button class="inventory-reject" data-delivery="${escapeHTML(row.id)}" data-approve="false">Rechazar</button></div>` : ''}</div>`).join('') || '<div class="inventory-empty">No hay entregas pendientes de aprobación.</div>';

    const assignForm = page.querySelector<HTMLFormElement>('#assignInventoryForm');
    if (assignForm) assignForm.onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const values = new FormData(form);
      const quantity = Math.floor(Number(values.get('quantity')));
      const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      submit.disabled = true;
      const { error } = await supabase!.rpc('assign_courier_inventory', {
        p_courier_id: String(values.get('courier_id') || ''),
        p_product_id: String(values.get('product_id') || ''),
        p_quantity: quantity,
      });
      if (error) {
        window.alert('No se pudo asignar el inventario: ' + error.message);
        submit.disabled = false;
        return;
      }
      form.querySelector<HTMLInputElement>('[name="quantity"]')!.value = '1';
      await loadInventory();
    };

    page.querySelectorAll<HTMLButtonElement>('[data-request]').forEach(action => action.addEventListener('click', async () => {
      action.disabled = true;
      const { error } = await supabase!.rpc('resolve_inventory_request', {
        p_request_id: action.dataset.request,
        p_approve: action.dataset.approve === 'true',
      });
      if (error) {
        window.alert('No se pudo revisar la solicitud: ' + error.message);
        action.disabled = false;
        return;
      }
      await loadInventory();
    }));

    page.querySelectorAll<HTMLButtonElement>('[data-delivery]').forEach(action => action.addEventListener('click', async () => {
      action.disabled = true;
      const { error } = await supabase!.rpc('review_inventory_delivery', {
        p_delivery_id: action.dataset.delivery,
        p_approve: action.dataset.approve === 'true',
      });
      if (error) {
        window.alert('No se pudo revisar la entrega: ' + error.message);
        action.disabled = false;
        return;
      }
      await loadInventory();
    }));
  }
}
