-- Use the delivery states shown to couriers; preserve assignment and admin terminal states.
alter table public.orders drop constraint if exists orders_status_check;

update public.orders
set status = case status
  when 'En camino' then 'En ruta'
  when 'Llegando' then 'De camino al cliente'
  else status
end
where status in ('En camino', 'Llegando');

alter table public.orders
  add constraint orders_status_check
  check (status in ('Pendiente', 'Asignado', 'En ruta', 'De camino al cliente', 'Entregado', 'No entregado', 'Cancelado'));
