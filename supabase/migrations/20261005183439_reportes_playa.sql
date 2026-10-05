-- Reportes en la playa, estilo Waze (docs/ideas/reportes-playa.md). Solo la base: todavía no hay UI.
-- Se reporta desde donde uno está; reportes del mismo tipo a menos de 150 m se agrupan.
-- Lo público son solo los reportes con 2 o más personas y sin vencer.
-- Sin PostGIS: para distancias de cientos de metros alcanza con haversine en SQL.

-- Distancia en metros entre dos puntos (lat/lng en grados).
create or replace function public.distancia_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Cuánto vive un reporte de cada tipo (y cuánto lo extiende un "sí, sigue"). null = tipo desconocido.
create or replace function public.reporte_duracion(p_tipo text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'lobo_marino' then interval '5 hours'
    when 'aguavivas' then interval '18 hours'
    when 'cianobacterias' then interval '24 hours'
    when 'fauna_varada' then interval '6 hours'
  end;
$$;

create table public.reportes (
  id bigint generated always as identity primary key,
  tipo text not null check (public.reporte_duracion(tipo) is not null),
  playa text not null check (char_length(playa) <= 40 and playa ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  lat double precision not null check (lat between -35.2 and -30),   -- Uruguay
  lng double precision not null check (lng between -58.6 and -53),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  expira timestamptz not null,
  confirmaciones integer not null default 0 check (confirmaciones >= 0),
  negaciones integer not null default 0 check (negaciones >= 0) -- "no" seguidos desde el último "sí"
);
create index reportes_activos_idx on public.reportes (expira, tipo);

-- Quien reporta cuenta como el primer "sí". Un voto por persona por reporte.
create table public.reporte_votos (
  reporte_id bigint not null references public.reportes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sigue boolean not null,
  creado timestamptz not null default now(),
  primary key (reporte_id, user_id)
);
create index reporte_votos_user_creado_idx on public.reporte_votos (user_id, creado);

-- Nadie toca las tablas directo: todo pasa por las funciones de abajo.
alter table public.reportes enable row level security;
alter table public.reporte_votos enable row level security;
revoke all on public.reportes from anon, authenticated;
revoke all on public.reporte_votos from anon, authenticated;

-- Tope de 30 reportes + votos por cuenta por día, para que no se use como basurero.
create or replace function public.reporte_votos_tope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.reporte_votos
      where user_id = new.user_id and creado > now() - interval '1 day') >= 30 then
    raise exception 'Tope de reportes por día alcanzado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger reporte_votos_tope
before insert on public.reporte_votos
for each row execute function public.reporte_votos_tope();

-- Mantiene los contadores: un "sí" extiende el vencimiento; dos "no" seguidos lo cierran.
create or replace function public.reporte_votos_contar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sigue then
    update public.reportes
    set confirmaciones = confirmaciones + 1,
        negaciones = 0,
        actualizado = now(),
        expira = greatest(expira, now() + public.reporte_duracion(tipo))
    where id = new.reporte_id;
  else
    update public.reportes
    set negaciones = negaciones + 1,
        actualizado = now(),
        expira = case when negaciones + 1 >= 2 then now() else expira end
    where id = new.reporte_id;
  end if;
  return new;
end;
$$;

create trigger reporte_votos_contar
after insert on public.reporte_votos
for each row execute function public.reporte_votos_contar();

-- Estado de un reporte para la cuenta actual (uso interno de las funciones de abajo).
create or replace function public.estado_reporte(p_id bigint)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', r.id,
    'tipo', r.tipo,
    'playa', r.playa,
    'lat', round(r.lat::numeric, 4),
    'lng', round(r.lng::numeric, 4),
    'confirmaciones', r.confirmaciones,
    'activo', r.expira > now(),
    'expira', r.expira,
    'miVoto', (select v.sigue from public.reporte_votos v
               where v.reporte_id = r.id and v.user_id = (select auth.uid()))
  )
  from public.reportes r
  where r.id = p_id;
$$;

-- Reportar desde donde estoy: suma al reporte activo más cercano del mismo tipo (≤ 150 m) o crea uno.
create or replace function public.reportar(p_tipo text, p_playa text, p_lng float8, p_lat float8)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Hace falta una cuenta' using errcode = 'insufficient_privilege';
  end if;
  if public.reporte_duracion(p_tipo) is null then
    raise exception 'Tipo de reporte desconocido' using errcode = 'check_violation';
  end if;

  select r.id into v_id
  from public.reportes r
  where r.tipo = p_tipo and r.expira > now()
    and public.distancia_m(r.lat, r.lng, p_lat, p_lng) <= 150
  order by public.distancia_m(r.lat, r.lng, p_lat, p_lng)
  limit 1;

  if v_id is null then
    insert into public.reportes (tipo, playa, lat, lng, expira)
    values (p_tipo, p_playa, round(p_lat::numeric, 5), round(p_lng::numeric, 5),
            now() + public.reporte_duracion(p_tipo))
    returning id into v_id;
  end if;

  insert into public.reporte_votos (reporte_id, user_id, sigue)
  values (v_id, (select auth.uid()), true)
  on conflict (reporte_id, user_id) do nothing;

  return public.estado_reporte(v_id);
end;
$$;

-- "¿Sigue ahí?": solo si el reporte está activo y estoy a 300 m o menos.
create or replace function public.votar_reporte(p_id bigint, p_sigue boolean, p_lng float8, p_lat float8)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Hace falta una cuenta' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.reportes r
    where r.id = p_id and r.expira > now()
      and public.distancia_m(r.lat, r.lng, p_lat, p_lng) <= 300
  ) then
    raise exception 'El reporte no está activo o estás lejos' using errcode = 'check_violation';
  end if;

  insert into public.reporte_votos (reporte_id, user_id, sigue)
  values (p_id, (select auth.uid()), p_sigue)
  on conflict (reporte_id, user_id) do nothing;

  return public.estado_reporte(p_id);
end;
$$;

-- Reportes activos a 300 m o menos (incluye los de una sola persona): para preguntar "¿sigue ahí?".
create or replace function public.reportes_cerca(p_lng float8, p_lat float8)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(public.estado_reporte(r.id) order by r.actualizado desc), '[]'::json)
  from public.reportes r
  where (select auth.uid()) is not null
    and r.expira > now()
    and public.distancia_m(r.lat, r.lng, p_lat, p_lng) <= 300;
$$;

-- Lo público, para el mapa: confirmados por 2 o más personas y sin vencer. Sin datos de cuentas.
create or replace function public.avistamientos_activos()
returns table (
  id bigint,
  tipo text,
  playa text,
  lat numeric,
  lng numeric,
  confirmaciones integer,
  actualizado timestamptz,
  expira timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.tipo, r.playa, round(r.lat::numeric, 4), round(r.lng::numeric, 4),
         r.confirmaciones, r.actualizado, r.expira
  from public.reportes r
  where r.expira > now() and r.confirmaciones >= 2
  order by r.actualizado desc;
$$;

revoke execute on function public.distancia_m(float8, float8, float8, float8) from public, anon, authenticated;
revoke execute on function public.reporte_duracion(text) from public, anon, authenticated;
revoke execute on function public.reporte_votos_tope() from public, anon, authenticated;
revoke execute on function public.reporte_votos_contar() from public, anon, authenticated;
revoke execute on function public.estado_reporte(bigint) from public, anon, authenticated;
revoke execute on function public.reportar(text, text, float8, float8) from public, anon;
revoke execute on function public.votar_reporte(bigint, boolean, float8, float8) from public, anon;
revoke execute on function public.reportes_cerca(float8, float8) from public, anon;
revoke execute on function public.avistamientos_activos() from public;
grant execute on function public.reportar(text, text, float8, float8) to authenticated;
grant execute on function public.votar_reporte(bigint, boolean, float8, float8) to authenticated;
grant execute on function public.reportes_cerca(float8, float8) to authenticated;
grant execute on function public.avistamientos_activos() to anon, authenticated;
