import { supabase } from './lib/supabase';

const query = new URLSearchParams(location.search);
const orderId = (query.get('pedido') || '').replace(/\D/g, '');
const token = query.get('token') || '';
const title = document.querySelector<HTMLElement>('#orderTitle')!;
const customerLine = document.querySelector<HTMLElement>('#customerLine')!;
const statusMessage = document.querySelector<HTMLElement>('#statusMessage')!;
const map = document.querySelector<HTMLIFrameElement>('#trackingMap')!;
const googleLink = document.querySelector<HTMLAnchorElement>('#googleLink')!;
const wazeLink = document.querySelector<HTMLAnchorElement>('#wazeLink')!;
const whatsappLink = document.querySelector<HTMLAnchorElement>('.btn.whatsapp')!;
const footnote = document.querySelector<HTMLElement>('#footnote')!;

type TrackingOrder = {
  order_id: number;
  customer_name: string;
  address: string;
  status: string;
  product_name: string;
  quantity: number;
  courier_name?: string | null;
  courier_phone?: string | null;
  courier_latitude?: number | null;
  courier_longitude?: number | null;
};

function setTimeline(status: string) {
  const flow = ['Pendiente', 'Asignado', 'En ruta', 'De camino al cliente', 'Entregado'];
  const completed = Math.max(0, flow.indexOf(status));
  document.querySelectorAll<HTMLElement>('.timeline li').forEach((item, index) => {
    item.classList.toggle('done', index < completed || status === 'Entregado');
    item.classList.toggle('current', index === completed && status !== 'Entregado');
  });
}

function setMap(address: string, latitude?: number | null, longitude?: number | null) {
  const destination = encodeURIComponent(address || 'Santo Domingo, República Dominicana');
  const hasCourierPosition = typeof latitude === 'number' && typeof longitude === 'number';
  map.src = `https://maps.google.com/maps?${hasCourierPosition ? `saddr=${latitude}%2C${longitude}&daddr=${destination}` : `q=${destination}`}&z=15&hl=es&output=embed`;
  googleLink.href = hasCourierPosition
    ? `https://www.google.com/maps/dir/?api=1&origin=${latitude}%2C${longitude}&destination=${destination}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  wazeLink.href = hasCourierPosition
    ? `https://waze.com/ul?ll=${latitude}%2C${longitude}&navigate=yes`
    : `https://waze.com/ul?q=${destination}&navigate=yes`;
}

function renderOrder(order: TrackingOrder) {
  title.textContent = `Pedido #${order.order_id}`;
  customerLine.textContent = `${order.customer_name} · ${order.address}`;
  statusMessage.textContent = `Estado: ${order.status}${order.courier_name ? ` · Mensajero: ${order.courier_name}` : ''}${order.product_name ? ` · ${order.product_name} × ${order.quantity}` : ''}`;
  setTimeline(order.status);
  setMap(order.address, order.courier_latitude, order.courier_longitude);
  if (order.courier_phone) {
    whatsappLink.href = `https://wa.me/${order.courier_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${order.courier_name || 'mensajero'}, te escribo por el pedido #${order.order_id}.`)}`;
  }
  footnote.textContent = 'El seguimiento se consulta desde RutaRD. La ubicación del mensajero se actualizará cuando comparta su posición.';
}

async function initializeTracking() {
  if (token && supabase) {
    const { data, error } = await supabase.rpc('get_tracking_info', { p_tracking_token: token });
    const order = Array.isArray(data) ? data[0] : data;
    if (error || !order) {
      statusMessage.textContent = 'No se encontró un pedido con este enlace de seguimiento.';
      footnote.textContent = 'Pide al mensajero un enlace vigente para este pedido.';
      return;
    }
    renderOrder(order as TrackingOrder);
    return;
  }

  let localOrder: any = null;
  try {
    const saved = JSON.parse(localStorage.getItem('rutard_orders') || '[]');
    localOrder = Array.isArray(saved) ? saved.find(order => String(order.id) === orderId) : null;
  } catch { /* Local demo data is optional. */ }
  if (localOrder) {
    renderOrder({
      order_id: Number(localOrder.id), customer_name: localOrder.name, address: localOrder.address,
      status: localOrder.status, product_name: localOrder.product, quantity: localOrder.quantity,
    });
    return;
  }
  if (orderId === '1254') {
    renderOrder({ order_id: 1254, customer_name: 'María González', address: 'Calle Euclides Morillo 18, Los Prados, Santo Domingo', status: 'En camino', product_name: 'Caja de cosméticos', quantity: 1, courier_name: 'Juan Martínez' });
    return;
  }
  title.textContent = `Pedido #${orderId || '—'}`;
  statusMessage.textContent = 'Este enlace no está conectado a un pedido disponible.';
  setMap('Santo Domingo, República Dominicana');
}

void initializeTracking();
export {};
