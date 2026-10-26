-- Playa favorita (README → "Playa favorita"). Una por persona (cuenta anónima de Supabase Auth, la
-- misma de los me gusta). No hay nada público: no se cuentan ni se muestran favoritas de otros.
-- La usa el mapa para poner la favorita primera en el listado y avisar si tiene bandera verde.

create table public.playa_favorita (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  playa text not null references public.playas (slug),
  actualizado timestamptz not null default now()
);
create index playa_favorita_playa_idx on public.playa_favorita (playa);

alter table public.playa_favorita enable row level security;

-- Cada uno ve, elige y saca solo la suya.
create policy "ver mi favorita" on public.playa_favorita
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "elegir favorita" on public.playa_favorita
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "cambiar favorita" on public.playa_favorita
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "sacar favorita" on public.playa_favorita
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.playa_favorita to authenticated;
grant select, insert, update, delete, truncate, references, trigger on public.playa_favorita to service_role;

-- Elige la favorita, o la saca si ya era esa. Devuelve la favorita nueva (null si no quedó ninguna).
create or replace function public.alternar_favorita(p_playa text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.playa_favorita
  where user_id = (select auth.uid()) and playa = p_playa;
  if found then
    return null;
  end if;
  insert into public.playa_favorita (playa) values (p_playa)
  on conflict (user_id) do update set playa = excluded.playa, actualizado = now();
  return p_playa;
end;
$$;

revoke execute on function public.alternar_favorita(text) from public, anon;
grant execute on function public.alternar_favorita(text) to authenticated;
