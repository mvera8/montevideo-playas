-- La favorita pasa a ser una casilla de guardavidas, no una playa (README → "Casilla favorita").
-- Se guarda la casilla (id de la IM, p. ej. 'MVD:lifeguardstation:1') y su playa: la playa ordena el
-- listado y valida con la FK a `playas`; la casilla lleva la estrella 3D y el aviso de bandera verde.
-- No hay tabla de casillas en la base (cambian en la IM): se valida solo el formato del id.
-- Las favoritas de antes (solo playa, de prueba) se borran: no hay casilla que asignarles.

drop function public.alternar_favorita(text);

alter table public.playa_favorita rename to casilla_favorita;
alter index public.playa_favorita_playa_idx rename to casilla_favorita_playa_idx;
delete from public.casilla_favorita;
alter table public.casilla_favorita
  add column casilla text not null
  check (char_length(casilla) <= 80 and casilla ~ '^[A-Za-z0-9:_-]+$');

-- Elige la casilla favorita, o la saca si ya era esa. Devuelve {playa, casilla} o null si no quedó ninguna.
create or replace function public.alternar_favorita(p_playa text, p_casilla text)
returns json
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.casilla_favorita
  where user_id = (select auth.uid()) and casilla = p_casilla;
  if found then
    return null;
  end if;
  insert into public.casilla_favorita (playa, casilla) values (p_playa, p_casilla)
  on conflict (user_id) do update set playa = excluded.playa, casilla = excluded.casilla, actualizado = now();
  return json_build_object('playa', p_playa, 'casilla', p_casilla);
end;
$$;

revoke execute on function public.alternar_favorita(text, text) from public, anon;
grant execute on function public.alternar_favorita(text, text) to authenticated;
