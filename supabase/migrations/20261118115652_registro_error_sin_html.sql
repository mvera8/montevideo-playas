-- registrar_hora(): si /api/registro no responde 200, el error guarda solo el estado (y el cuerpo si no es
-- una página HTML). Antes guardaba el comienzo del HTML de la página de error, que ensuciaba
-- `analisis_cobertura`.
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
      raise exception '%', format('HTTP %s%s', v_resp.status,
        case when v_resp.content_type like 'text/html%' then '' else ': ' || left(v_resp.content, 200) end);
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

-- La corrida de prueba del 18/11, antes del deploy de /api/registro (404 con el HTML).
delete from public.registro_corridas where estado_http = 404 and en < '2026-11-18 12:00+00';
