-- Registro de errores del sitio (README → "Errores"). Reemplaza a un servicio tipo Sentry.
-- Lo escriben el servidor (onRequestError en src/instrumentation.ts) y el navegador (error.tsx y
-- global-error.tsx), siempre con la clave publicable y por la función `registrar_error`.
-- Nadie puede leerla con la API: se mira desde el dashboard de Supabase o el conector.
-- Sin IP ni datos de cuentas. Se agrupa por huella y día; se borra a los 30 días.

create table public.errores (
  id bigint generated always as identity primary key,
  huella text not null,                        -- md5(origen | mensaje | ruta): mismo error = misma fila
  dia date not null default current_date,
  origen text not null check (origen in ('servidor', 'cliente')),
  mensaje text not null check (char_length(mensaje) <= 500),
  ruta text check (char_length(ruta) <= 200),  -- sin query string
  contexto text check (char_length(contexto) <= 100),
  digest text check (char_length(digest) <= 40),
  stack text check (char_length(stack) <= 2000),
  navegador text check (char_length(navegador) <= 200),
  veces integer not null default 1,
  primera timestamptz not null default now(),
  ultima timestamptz not null default now(),
  unique (huella, dia)
);
create index errores_dia_idx on public.errores (dia);

alter table public.errores enable row level security;
revoke all on public.errores from anon, authenticated;

-- Guarda un error o suma uno al mismo error del día. Recorta los textos en vez de fallar.
-- Tope de 200 errores distintos por día (los repetidos siguen sumando): que no se use de basurero.
create or replace function public.registrar_error(
  p_origen text,
  p_mensaje text,
  p_ruta text default null,
  p_contexto text default null,
  p_digest text default null,
  p_stack text default null,
  p_navegador text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mensaje text := left(coalesce(nullif(p_mensaje, ''), '(sin mensaje)'), 500);
  v_ruta text := left(split_part(p_ruta, '?', 1), 200);
  v_huella text;
begin
  if p_origen is null or p_origen not in ('servidor', 'cliente') then return; end if;
  v_huella := md5(p_origen || '|' || v_mensaje || '|' || coalesce(v_ruta, ''));

  update public.errores
  set veces = veces + 1, ultima = now()
  where huella = v_huella and dia = current_date;
  if found then return; end if;

  if (select count(*) from public.errores where dia = current_date) >= 200 then return; end if;

  -- Limpieza al pasar: solo cuando entra un error nuevo, con índice por día.
  delete from public.errores where dia < current_date - 30;

  insert into public.errores (huella, origen, mensaje, ruta, contexto, digest, stack, navegador)
  values (v_huella, p_origen, v_mensaje, v_ruta, left(p_contexto, 100), left(p_digest, 40),
          left(p_stack, 2000), left(p_navegador, 200))
  on conflict (huella, dia) do update set veces = public.errores.veces + 1, ultima = now();
end;
$$;

revoke execute on function public.registrar_error(text, text, text, text, text, text, text) from public;
grant execute on function public.registrar_error(text, text, text, text, text, text, text) to anon, authenticated;
