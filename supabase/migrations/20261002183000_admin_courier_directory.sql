-- Let approved administrators correct courier display details without changing
-- the account role, approval state, or other protected profile fields.
create policy "Admins can update courier contact details"
  on public.profiles for update to authenticated
  using ((select private.is_approved_admin()) and role = 'courier')
  with check ((select private.is_approved_admin()) and role = 'courier');

-- New profiles retain the name and phone supplied during courier signup.
-- Use the email prefix only when signup metadata omitted a name.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  profile_phone text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), '');
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(profile_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Mensajero'),
    profile_phone
  )
  on conflict (id) do update
    set full_name = case when profile_name is not null then profile_name else public.profiles.full_name end,
        phone = case when profile_phone <> '' then profile_phone else public.profiles.phone end,
        updated_at = now();
  return new;
end;
$$;

-- Give existing accounts a usable name when their signup did not include one.
update public.profiles as p
set full_name = coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Mensajero'),
    updated_at = now()
from auth.users as u
where p.id = u.id
  and nullif(btrim(p.full_name), '') is null;
