create table public.courier_inventory (
  courier_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  quantity_assigned integer not null default 0 check (quantity_assigned >= 0),
  quantity_available integer not null default 0 check (quantity_available >= 0),
  quantity_delivered integer not null default 0 check (quantity_delivered >= 0),
  updated_at timestamptz not null default now(),
  primary key (courier_id, product_id),
  check (quantity_assigned = quantity_available + quantity_delivered)
);

create table public.inventory_requests (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table public.inventory_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null unique references public.orders(id) on delete restrict,
  courier_id uuid not null references public.profiles(id) on delete restrict,
  product_id text not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  delivered_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create index courier_inventory_courier_updated_idx on public.courier_inventory (courier_id, updated_at desc);
create index inventory_requests_status_date_idx on public.inventory_requests (status, requested_at desc);
create index inventory_deliveries_status_date_idx on public.inventory_deliveries (status, delivered_at desc);

alter table public.courier_inventory enable row level security;
alter table public.inventory_requests enable row level security;
alter table public.inventory_deliveries enable row level security;

grant select, insert, update, delete on public.courier_inventory to authenticated;
grant select, insert, update on public.inventory_requests to authenticated;
grant select, update on public.inventory_deliveries to authenticated;

create policy "Admins and assigned couriers can view courier inventory"
  on public.courier_inventory for select to authenticated
  using ((select private.is_approved_admin()) or ((select private.is_approved_courier()) and courier_id = (select auth.uid())));
create policy "Admins manage courier inventory"
  on public.courier_inventory for all to authenticated
  using ((select private.is_approved_admin()))
  with check ((select private.is_approved_admin()));

create policy "Admins and request owners can view inventory requests"
  on public.inventory_requests for select to authenticated
  using ((select private.is_approved_admin()) or ((select private.is_approved_courier()) and courier_id = (select auth.uid())));
create policy "Approved couriers can request inventory for themselves"
  on public.inventory_requests for insert to authenticated
  with check (
    (select private.is_approved_courier())
    and courier_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy "Admins can review inventory requests"
  on public.inventory_requests for update to authenticated
  using ((select private.is_approved_admin()))
  with check ((select private.is_approved_admin()));

create policy "Admins and delivery owners can view inventory deliveries"
  on public.inventory_deliveries for select to authenticated
  using ((select private.is_approved_admin()) or ((select private.is_approved_courier()) and courier_id = (select auth.uid())));
create policy "Admins can approve inventory deliveries"
  on public.inventory_deliveries for update to authenticated
  using ((select private.is_approved_admin()))
  with check ((select private.is_approved_admin()));

create function public.assign_courier_inventory(p_courier_id uuid, p_product_id text, p_quantity integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_approved_admin()) then
    raise exception 'Solo el administrador puede asignar inventario.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad asignada debe ser mayor que cero.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_courier_id and role = 'courier' and approval_status = 'approved'
  ) then
    raise exception 'Selecciona un mensajero aprobado.' using errcode = '22023';
  end if;
  insert into public.courier_inventory (courier_id, product_id, quantity_assigned, quantity_available)
  select p_courier_id, p.id, p_quantity, p_quantity
  from public.products p
  where p.id = p_product_id and p.is_active
  on conflict (courier_id, product_id) do update
    set quantity_assigned = public.courier_inventory.quantity_assigned + excluded.quantity_assigned,
        quantity_available = public.courier_inventory.quantity_available + excluded.quantity_available,
        updated_at = now();
  if not found then
    raise exception 'Selecciona un producto activo.' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.assign_courier_inventory(uuid, text, integer) from public, anon;
grant execute on function public.assign_courier_inventory(uuid, text, integer) to authenticated;

create function public.resolve_inventory_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_row public.inventory_requests%rowtype;
begin
  if not (select private.is_approved_admin()) then
    raise exception 'Solo el administrador puede revisar solicitudes.' using errcode = '42501';
  end if;
  select * into request_row
  from public.inventory_requests
  where id = p_request_id
  for update;
  if not found or request_row.status <> 'pending' then
    raise exception 'La solicitud ya fue revisada o no existe.' using errcode = 'P0002';
  end if;
  update public.inventory_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = p_request_id;
  if p_approve then
    insert into public.courier_inventory (courier_id, product_id, quantity_assigned, quantity_available)
    select request_row.courier_id, p.id, request_row.quantity, request_row.quantity
    from public.products p
    where p.id = request_row.product_id and p.is_active
    on conflict (courier_id, product_id) do update
      set quantity_assigned = public.courier_inventory.quantity_assigned + excluded.quantity_assigned,
          quantity_available = public.courier_inventory.quantity_available + excluded.quantity_available,
          updated_at = now();
    if not found then
      raise exception 'El producto solicitado ya no está activo.' using errcode = '22023';
    end if;
  end if;
end;
$$;
revoke all on function public.resolve_inventory_request(uuid, boolean) from public, anon;
grant execute on function public.resolve_inventory_request(uuid, boolean) to authenticated;

create function public.review_inventory_delivery(p_delivery_id uuid, p_approve boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_approved_admin()) then
    raise exception 'Solo el administrador puede aprobar las entregas.' using errcode = '42501';
  end if;
  update public.inventory_deliveries
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = p_delivery_id and status = 'pending';
  if not found then
    raise exception 'La entrega ya fue revisada o no existe.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.review_inventory_delivery(uuid, boolean) from public, anon;
grant execute on function public.review_inventory_delivery(uuid, boolean) to authenticated;

create function private.record_courier_inventory_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'Entregado' and old.status is distinct from 'Entregado' then
    if (select auth.uid()) is null
       or (not (select private.is_approved_admin())
           and (not (select private.is_approved_courier()) or new.courier_id is distinct from (select auth.uid()))) then
      raise exception 'No tienes permiso para registrar esta entrega.' using errcode = '42501';
    end if;
    if old.status = 'Entregado' then
      raise exception 'La entrega ya fue registrada.' using errcode = '23505';
    end if;
    if new.product_id is not null then
      update public.courier_inventory
      set quantity_available = quantity_available - new.quantity,
          quantity_delivered = quantity_delivered + new.quantity,
          updated_at = now()
      where courier_id = new.courier_id
        and product_id = new.product_id
        and quantity_available >= new.quantity;
      if not found then
        raise exception 'No hay inventario suficiente asignado para este producto. Solicítalo al administrador.' using errcode = '23514';
      end if;
      insert into public.inventory_deliveries (order_id, courier_id, product_id, quantity)
      values (new.id, new.courier_id, new.product_id, new.quantity);
    end if;
  elsif old.status = 'Entregado' and new.status <> 'Entregado'
        and not (select private.is_approved_admin()) then
    raise exception 'El administrador debe corregir una entrega completada.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.record_courier_inventory_delivery() from public, anon, authenticated;

create trigger orders_record_courier_inventory_delivery
  before update of status on public.orders
  for each row execute function private.record_courier_inventory_delivery();

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['orders', 'inventory_requests', 'inventory_deliveries', 'courier_inventory'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
