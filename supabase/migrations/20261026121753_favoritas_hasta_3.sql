-- Hasta 3 casillas favoritas por persona (antes, una: elegir otra reemplazaba la anterior).
-- README → "Casillas favoritas". El tope va en un trigger (como `me_gusta_tope`), no en la política.

alter table public.casilla_favorita drop constraint playa_favorita_pkey;
alter table public.casilla_favorita add primary key (user_id, casilla);

create or replace function public.casilla_favorita_tope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.casilla_favorita where user_id = new.user_id) >= 3 then
    raise exception 'Tope de 3 casillas favoritas' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.casilla_favorita_tope() from public, anon, authenticated;

create trigger casilla_favorita_tope
before insert on public.casilla_favorita
for each row execute function public.casilla_favorita_tope();

-- Agrega la casilla o la saca si ya estaba. Devuelve todas las favoritas: [{playa, casilla}, …].
-- Con 3 ya elegidas, agregar otra falla con check_violation (el navegador muestra un aviso).
drop function public.alternar_favorita(text, text);
create or replace function public.alternar_favorita(p_playa text, p_casilla text)
returns json
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.casilla_favorita
  where user_id = (select auth.uid()) and casilla = p_casilla;
  if not found then
    insert into public.casilla_favorita (playa, casilla) values (p_playa, p_casilla);
  end if;
  return coalesce((
    select json_agg(json_build_object('playa', playa, 'casilla', casilla) order by actualizado)
    from public.casilla_favorita
    where user_id = (select auth.uid())
  ), '[]'::json);
end;
$$;

revoke execute on function public.alternar_favorita(text, text) from public, anon;
grant execute on function public.alternar_favorita(text, text) to authenticated;
