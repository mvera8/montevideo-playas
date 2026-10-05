-- La temporada de me gusta sigue a la de guardavidas (15/11 al 30/04): cierra el 30 de abril.
-- Lo que se vota desde el 1 de mayo suma a la temporada siguiente ('2027-28'), así que se puede votar
-- todo el año. Antes iba de julio a junio. Los me gusta ya guardados ('2026-27') no cambian.
-- Misma regla que `temporadaMeGusta()` en src/lib/me-gusta-temporada.ts.

create or replace function public.temporada_actual()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when extract(month from (now() at time zone 'America/Montevideo')) >= 5
      then to_char(now() at time zone 'America/Montevideo', 'YYYY') || '-' ||
           to_char((now() at time zone 'America/Montevideo') + interval '1 year', 'YY')
    else to_char((now() at time zone 'America/Montevideo') - interval '1 year', 'YYYY') || '-' ||
         to_char(now() at time zone 'America/Montevideo', 'YY')
  end;
$$;
