-- Una sola casilla favorita por persona (antes, hasta 3): elegir otra reemplaza la anterior.
-- README → "Casilla favorita". Quien tenía varias se queda con la última que marcó.

delete from public.casilla_favorita a
using public.casilla_favorita b
where a.user_id = b.user_id
  and (a.actualizado, a.casilla) < (b.actualizado, b.casilla);

-- La PK por persona ya garantiza el tope: el trigger deja de hacer falta.
drop trigger casilla_favorita_tope on public.casilla_favorita;
drop function public.casilla_favorita_tope();

alter table public.casilla_favorita drop constraint casilla_favorita_pkey;
alter table public.casilla_favorita add primary key (user_id);

-- Elige la casilla, reemplaza la anterior o la saca si ya era esa. Sigue devolviendo una lista
-- ([{playa, casilla}] o []) para no romper a quien tenga abierta la versión anterior del sitio.
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
    insert into public.casilla_favorita (playa, casilla) values (p_playa, p_casilla)
    on conflict (user_id) do update set playa = excluded.playa, casilla = excluded.casilla, actualizado = now();
  end if;
  return coalesce((
    select json_agg(json_build_object('playa', playa, 'casilla', casilla))
    from public.casilla_favorita
    where user_id = (select auth.uid())
  ), '[]'::json);
end;
$$;
