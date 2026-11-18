-- Registro de la temporada (11/2026): banderas, clima y agua cada 30 min de 8 a 20 h, para analizar la
-- temporada al final (README → "Registro de la temporada"; la foto la arma src/lib/registro.ts).
--
-- Lo toma la base, no Vercel: pg_cron corre public.registrar_hora(), que pide GET /api/registro del sitio
-- con la extensión `http` y guarda la respuesta. Vercel no escribe acá y no hace falta ninguna clave.
--
-- Las tablas no se exponen a la API (RLS sin políticas y sin grants a anon/authenticated): se consultan
-- desde el SQL Editor de Supabase. Para el análisis, las vistas `analisis_*` (ver al final).

create extension if not exists http with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Cada pedido a /api/registro, haya salido bien o no: sirve para medir la cobertura del registro.
create table public.registro_corridas (
  id bigint generated always as identity primary key,
  en timestamptz not null default now(),
  estado_http int,
  fuente text, -- 'im' o 'respaldo' (el servidor no llegó a la IM: sin banderas)
  banderas_ok boolean not null default false,
  casillas int not null default 0,
  playas int not null default 0,
  muestras_nuevas int not null default 0,
  uv_im real, -- UV medido por la IM en la ciudad (null si no hay dato vigente)
  error text,
  duracion_ms int
);

-- Bandera de cada casilla en cada hora. Dos fotos por hora: la segunda pisa a la primera.
create table public.registro_casillas (
  casilla text not null,
  hora timestamptz not null, -- hora en punto (UTC en la base; las vistas pasan a Montevideo)
  playa text not null references public.playas (slug),
  bandera text check (bandera in ('green', 'yellow', 'red', 'black')), -- null: sin bandera vigente
  sanitaria boolean, -- null: la IM no informa una vigente
  sanitaria_causa text,
  actualizado timestamptz not null default now(),
  primary key (casilla, hora)
);

-- Clima y estado del agua de cada playa en cada hora.
create table public.registro_playas (
  playa text not null references public.playas (slug),
  hora timestamptz not null,
  pronostico_hora timestamptz, -- paso del pronóstico de MET Norway (las vistas descartan los de > 3 h)
  temp_aire real,
  sensacion real,
  humedad real,
  viento_kmh real,
  viento_dir smallint, -- de dónde sopla (0 = norte)
  cielo smallint, -- código WMO
  uv_max real, -- UV máximo del día con cielo despejado (estimado de MET, no medido)
  temp_agua real, -- NOAA OISST (satélite, diaria)
  ola_m real, -- WaveWatch III, mar afuera, orientativa
  agua_estado text check (agua_estado in ('apta', 'no-apta', 'sin-datos')),
  ciano text,
  actualizado timestamptz not null default now(),
  primary key (playa, hora)
);

-- Muestras de agua de la IM (SECCA): cada una se guarda una vez.
create table public.registro_muestras_agua (
  playa text not null references public.playas (slug),
  punto text not null,
  fecha timestamp not null, -- hora local de Montevideo, como la publica la IM
  enterococos real, -- UFC/100 ml
  ciano text check (ciano in ('ausencia', 'presencia', 'espuma')),
  representativa boolean not null, -- false: llovió en las 24 h previas
  primary key (playa, punto, fecha)
);

create index registro_casillas_playa_hora on public.registro_casillas (playa, hora);

alter table public.registro_corridas enable row level security;
alter table public.registro_casillas enable row level security;
alter table public.registro_playas enable row level security;
alter table public.registro_muestras_agua enable row level security;
revoke all on public.registro_corridas, public.registro_casillas, public.registro_playas, public.registro_muestras_agua
  from anon, authenticated;
grant select, insert, update, delete on public.registro_corridas, public.registro_casillas, public.registro_playas,
  public.registro_muestras_agua to service_role;

-- Guarda una foto de /api/registro (separada de registrar_hora para poder probarla con un JSON a mano).
-- Devuelve cuántas filas guardó. `p_hora`: la hora en punto a la que corresponde.
create or replace function public.guardar_registro(p_d jsonb, p_hora timestamptz, out casillas int, out playas int, out muestras int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.registro_casillas (casilla, hora, playa, bandera, sanitaria, sanitaria_causa)
  select x.casilla, p_hora, x.playa, x.bandera, x.sanitaria, x.sanitaria_causa
  from jsonb_to_recordset(p_d -> 'casillas')
    as x (casilla text, playa text, bandera text, sanitaria boolean, sanitaria_causa text)
  join public.playas p on p.slug = x.playa -- una playa nueva de la IM se ignora hasta sumarla a `playas`
  on conflict (casilla, hora) do update
    set bandera = excluded.bandera, sanitaria = excluded.sanitaria,
        sanitaria_causa = excluded.sanitaria_causa, actualizado = now();
  get diagnostics casillas = row_count;

  insert into public.registro_playas (playa, hora, pronostico_hora, temp_aire, sensacion, humedad, viento_kmh,
    viento_dir, cielo, uv_max, temp_agua, ola_m, agua_estado, ciano)
  select x.playa, p_hora, x.pronostico_hora, x.temp_aire, x.sensacion, x.humedad, x.viento_kmh,
    x.viento_dir, x.cielo, x.uv_max, x.temp_agua, x.ola_m, x.agua_estado, x.ciano
  from jsonb_to_recordset(p_d -> 'playas')
    as x (playa text, pronostico_hora timestamptz, temp_aire real, sensacion real, humedad real, viento_kmh real,
          viento_dir smallint, cielo smallint, uv_max real, temp_agua real, ola_m real, agua_estado text, ciano text)
  join public.playas p on p.slug = x.playa
  on conflict (playa, hora) do update
    set pronostico_hora = excluded.pronostico_hora, temp_aire = excluded.temp_aire, sensacion = excluded.sensacion,
        humedad = excluded.humedad, viento_kmh = excluded.viento_kmh, viento_dir = excluded.viento_dir,
        cielo = excluded.cielo, uv_max = excluded.uv_max, temp_agua = excluded.temp_agua, ola_m = excluded.ola_m,
        agua_estado = excluded.agua_estado, ciano = excluded.ciano, actualizado = now();
  get diagnostics playas = row_count;

  insert into public.registro_muestras_agua (playa, punto, fecha, enterococos, ciano, representativa)
  select x.playa, x.punto, x.fecha, x.enterococos, x.ciano, x.representativa
  from jsonb_to_recordset(p_d -> 'muestras')
    as x (playa text, punto text, fecha timestamp, enterococos real, ciano text, representativa boolean)
  join public.playas p on p.slug = x.playa
  on conflict do nothing;
  get diagnostics muestras = row_count;
end;
$$;

-- Pide la foto y la guarda. Si algo falla, queda la corrida con el error y no se guarda nada a medias.
create or replace function public.registrar_hora()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := clock_timestamp();
  v_resp extensions.http_response;
  v_d jsonb;
  v_g record;
begin
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '60');
    v_resp := extensions.http_get('https://montevideo.playas.uy/api/registro');
    if v_resp.status <> 200 then
      raise exception 'HTTP %: %', v_resp.status, left(v_resp.content, 200);
    end if;
    v_d := v_resp.content::jsonb;
    select * into v_g from public.guardar_registro(v_d, date_trunc('hour', now()));

    insert into public.registro_corridas (estado_http, fuente, banderas_ok, casillas, playas, muestras_nuevas, uv_im, duracion_ms)
    values (v_resp.status, v_d ->> 'fuente', v_g.casillas > 0, v_g.casillas, v_g.playas, v_g.muestras,
      (v_d ->> 'uv_im')::real, extract(milliseconds from clock_timestamp() - v_inicio)::int);
  exception when others then
    insert into public.registro_corridas (estado_http, error, duracion_ms)
    values (v_resp.status, left(sqlerrm, 500), extract(milliseconds from clock_timestamp() - v_inicio)::int);
  end;

  -- Las corridas solo sirven para medir cobertura: se guardan 400 días.
  delete from public.registro_corridas where en < now() - interval '400 days';
end;
$$;

revoke execute on function public.registrar_hora() from public, anon, authenticated;
revoke execute on function public.guardar_registro(jsonb, timestamptz) from public, anon, authenticated;

-- 8:10, 8:40 … 19:40 en Montevideo (UTC−3 fijo; pg_cron usa UTC). Después de las 20 h las banderas vencen.
select cron.schedule('registro-temporada', '10,40 11-22 * * *', 'select public.registrar_hora()');

-- ---------- Vistas para el análisis ----------
-- Bandera de la playa en cada hora = la más restrictiva de sus casillas (mismo criterio que el mapa:
-- roja > negra > amarilla > verde).

create view public.analisis_banderas_hora with (security_invoker = true) as
select
  playa,
  hora,
  (hora at time zone 'America/Montevideo')::date as fecha,
  extract(hour from hora at time zone 'America/Montevideo')::int as hora_local,
  max(case bandera when 'red' then 4 when 'black' then 3 when 'yellow' then 2 when 'green' then 1 else 0 end) as nivel,
  (array['sin bandera', 'verde', 'amarilla', 'negra', 'roja'])[
    max(case bandera when 'red' then 4 when 'black' then 3 when 'yellow' then 2 when 'green' then 1 else 0 end) + 1
  ] as bandera,
  coalesce(bool_or(sanitaria), false) as sanitaria
from public.registro_casillas
group by playa, hora;

-- Un día por playa: horas con cada color, la peor y la que más duró.
create view public.analisis_banderas_dia with (security_invoker = true) as
select
  playa,
  fecha,
  count(*) as horas_registradas,
  count(*) filter (where nivel = 1) as horas_verde,
  count(*) filter (where nivel = 2) as horas_amarilla,
  count(*) filter (where nivel = 4) as horas_roja,
  count(*) filter (where nivel = 3) as horas_negra,
  count(*) filter (where nivel = 0) as horas_sin_bandera,
  (array['sin bandera', 'verde', 'amarilla', 'negra', 'roja'])[max(nivel) + 1] as peor,
  (array['verde', 'amarilla', 'negra', 'roja'])[mode() within group (order by nivel) filter (where nivel > 0)] as predominante,
  bool_or(sanitaria) as hubo_sanitaria
from public.analisis_banderas_hora
group by playa, fecha;

-- Clima y agua por playa y día (solo pronósticos de menos de 3 h al momento de la foto).
create view public.analisis_clima_dia with (security_invoker = true) as
select
  playa,
  (hora at time zone 'America/Montevideo')::date as fecha,
  round(avg(temp_aire)::numeric, 1) as temp_aire_media,
  max(temp_aire) as temp_aire_max,
  round(avg(viento_kmh)::numeric, 1) as viento_medio_kmh,
  max(viento_kmh) as viento_max_kmh,
  round(avg(ola_m)::numeric, 2) as ola_media_m,
  round(avg(temp_agua)::numeric, 1) as temp_agua_media,
  max(uv_max) as uv_max,
  bool_or(agua_estado = 'no-apta') as agua_no_apta,
  bool_or(ciano in ('presencia', 'espuma')) as cianobacterias
from public.registro_playas
where pronostico_hora is null or hora - pronostico_hora < interval '3 hours'
group by playa, (hora at time zone 'America/Montevideo')::date;

-- Resumen de la temporada por playa (filtrar por fechas para una temporada puntual).
create view public.analisis_temporada with (security_invoker = true) as
with b as (
  select playa,
    count(distinct fecha) as dias_registrados,
    count(*) filter (where nivel > 0) as horas_con_bandera,
    count(*) filter (where nivel = 1) as horas_verde,
    count(*) filter (where nivel = 2) as horas_amarilla,
    count(*) filter (where nivel = 4) as horas_roja,
    count(*) filter (where nivel = 3) as horas_negra,
    count(distinct fecha) filter (where nivel = 4) as dias_con_roja,
    count(distinct fecha) filter (where sanitaria) as dias_con_sanitaria
  from public.analisis_banderas_hora
  group by playa
), c as (
  select playa,
    round(avg(temp_aire_media), 1) as temp_aire_media,
    round(avg(viento_medio_kmh), 1) as viento_medio_kmh,
    round(avg(ola_media_m), 2) as ola_media_m,
    round(avg(temp_agua_media), 1) as temp_agua_media,
    count(*) filter (where agua_no_apta) as dias_agua_no_apta
  from public.analisis_clima_dia
  group by playa
), m as (
  select playa,
    count(*) as muestras_agua,
    count(*) filter (where enterococos > 500) as muestras_sobre_500,
    round(percentile_cont(0.5) within group (order by enterococos)::numeric) as enterococos_mediana
  from public.registro_muestras_agua
  where fecha >= '2026-11-15' -- inicio de la temporada 2026-27: cambiarlo para la próxima
  group by playa
)
select
  p.slug as playa,
  p.nombre,
  b.dias_registrados,
  round(100.0 * b.horas_verde / nullif(b.horas_con_bandera, 0), 1) as pct_verde,
  round(100.0 * b.horas_amarilla / nullif(b.horas_con_bandera, 0), 1) as pct_amarilla,
  round(100.0 * b.horas_roja / nullif(b.horas_con_bandera, 0), 1) as pct_roja,
  round(100.0 * b.horas_negra / nullif(b.horas_con_bandera, 0), 1) as pct_negra,
  b.dias_con_roja,
  b.dias_con_sanitaria,
  c.temp_aire_media,
  c.viento_medio_kmh,
  c.ola_media_m,
  c.temp_agua_media,
  c.dias_agua_no_apta,
  m.muestras_agua,
  m.muestras_sobre_500,
  m.enterococos_mediana
from public.playas p
left join b on b.playa = p.slug
left join c on c.playa = p.slug
left join m on m.playa = p.slug;

-- Cobertura: cuántas fotos salieron bien por día (las banderas fallan cuando Vercel no llega a la IM).
create view public.analisis_cobertura with (security_invoker = true) as
select
  (en at time zone 'America/Montevideo')::date as fecha,
  count(*) as corridas,
  count(*) filter (where error is null) as ok,
  count(*) filter (where banderas_ok) as con_banderas,
  count(*) filter (where error is not null) as con_error,
  (array_agg(error order by en desc) filter (where error is not null))[1] as ultimo_error
from public.registro_corridas
group by 1;

revoke all on public.analisis_banderas_hora, public.analisis_banderas_dia, public.analisis_clima_dia,
  public.analisis_temporada, public.analisis_cobertura from anon, authenticated;
grant select on public.analisis_banderas_hora, public.analisis_banderas_dia, public.analisis_clima_dia,
  public.analisis_temporada, public.analisis_cobertura to service_role;
