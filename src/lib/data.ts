import { supabase } from './supabase';

export type ZoneRecord = { id: string; name: string; type: string; province: string; municipality: string; price: number };
export type ProductRecord = { id: string; name: string; price: number };
export type OrderRecord = {
  id: string; name: string; address: string; mapLink?: string; phone?: string;
  productId?: string; product?: string; quantity?: number; unitPrice?: number;
  zoneId?: string; zone?: string; deliveryFee?: number; total?: number;
  courier?: string; courierId?: string | null; status?: string; trackingToken?: string;
};

export async function persistZones(rows: ZoneRecord[]) {
  if (!supabase || !rows.length) return;
  const { error } = await supabase.from('delivery_zones').upsert(rows.map(row => ({
    id: row.id,
    name: row.name,
    zone_type: row.type,
    province: row.province,
    municipality: row.municipality,
    delivery_fee: Number(row.price) || 0,
  })), { onConflict: 'id' });
  if (error) throw error;
}

export async function persistProducts(rows: ProductRecord[]) {
  if (!supabase || !rows.length) return;
  const { error } = await supabase.from('products').upsert(rows.map(row => ({
    id: row.id,
    name: row.name,
    default_price: Number(row.price) || 0,
    is_active: true,
  })), { onConflict: 'id' });
  if (error) throw error;
}

export async function persistOrders(rows: OrderRecord[]) {
  if (!supabase || !rows.length) return;
  const ids = rows.map(row => Number(row.id)).filter(Number.isFinite);
  const { data: existing, error: lookupError } = await supabase.from('orders').select('id').in('id', ids);
  if (lookupError) throw lookupError;
  const existingIds = new Set((existing || []).map(row => Number(row.id)));
  for (const row of rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    if (existingIds.has(id)) {
      // Couriers receive UPDATE permission for status only; never send the whole order on an update.
      const { error } = await supabase.from('orders').update({ status: row.status || 'Pendiente' }).eq('id', id);
      if (error) throw error;
      continue;
    }
    const { error } = await supabase.from('orders').insert({
      id,
      tracking_token: row.trackingToken || crypto.randomUUID(),
      customer_name: row.name,
      customer_phone: row.phone || '',
      address: row.address,
      map_link: row.mapLink || '',
      product_id: row.productId || null,
      product_name: row.product || '',
      quantity: Number(row.quantity) || 1,
      unit_price: Number(row.unitPrice) || 0,
      zone_id: row.zoneId || null,
      zone_name: row.zone || '',
      delivery_fee: Number(row.deliveryFee) || 0,
      courier_id: row.courierId || null,
      courier_name: row.courier || 'Sin asignar',
      status: row.status || 'Pendiente',
    });
    if (error) throw error;
  }
}

export function fromDatabaseZone(row: any): ZoneRecord {
  return { id: row.id, name: row.name, type: row.zone_type, province: row.province, municipality: row.municipality, price: Number(row.delivery_fee) || 0 };
}

export function fromDatabaseProduct(row: any): ProductRecord {
  return { id: row.id, name: row.name, price: Number(row.default_price) || 0 };
}

export function fromDatabaseOrder(row: any): OrderRecord {
  return {
    id: String(row.id), trackingToken: row.tracking_token, name: row.customer_name, address: row.address, mapLink: row.map_link,
    phone: row.customer_phone, productId: row.product_id || undefined, product: row.product_name,
    quantity: Number(row.quantity) || 1, unitPrice: Number(row.unit_price) || 0,
    zoneId: row.zone_id || undefined, zone: row.zone_name, deliveryFee: Number(row.delivery_fee) || 0,
    total: Number(row.total) || 0, courierId: row.courier_id, courier: row.courier_name || 'Sin asignar',
    status: row.status === 'En camino' ? 'En ruta' : row.status === 'Llegando' ? 'De camino al cliente' : row.status,
  };
}
