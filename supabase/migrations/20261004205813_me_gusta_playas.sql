-- "Me gusta" en las playas (docs/ideas/me-gusta-playas.md).
-- Un me gusta por persona (cuenta anónima de Supabase Auth) por playa por temporada.
-- La temporada va de julio a junio (verano en el medio): '2026-27'.

create or replace function public.temporada_actual()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when extract(month from (now() at time zone 'America/Montevideo')) >= 7
      then to_char(now() at time zone 'America/Montevideo', 'YYYY') || '-' ||
           to_char((now() at time zone 'America/Montevideo') + interval '1 year', 'YY')
    else to_char((now() at time zone 'America/Montevideo') - interval '1 year', 'YYYY') || '-' ||
         to_char(now() at time zone 'America/Montevideo', 'YY')
  end;
$$;

create table public.me_gusta (
  playa text not null check (char_length(playa) <= 40 and playa ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  temporada text not null default public.temporada_actual(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (playa, temporada, user_id)
);
create index me_gusta_user_temporada_idx on public.me_gusta (user_id, temporada);

-- Totales precalculados: lo único público.
create table public.me_gusta_totales (
  playa text not null,
  temporada text not null,
  total integer not null default 0 check (total >= 0),
  primary key (playa, temporada)
);

alter table public.me_gusta enable row level security;
alter table public.me_gusta_totales enable row level security;

-- Cada uno ve, da y saca solo sus propios me gusta, y solo en la temporada actual.
-- Tope de 60 por temporada por cuenta (hay ~20 playas) para que no se use como basurero.
create policy "ver mis me gusta" on public.me_gusta
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "dar me gusta" on public.me_gusta
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and temporada = public.temporada_actual()
    and (select count(*) from public.me_gusta m
         where m.user_id = (select auth.uid()) and m.temporada = public.temporada_actual()) < 60
  );

create policy "sacar me gusta" on public.me_gusta
  for delete to authenticated
  using ((select auth.uid()) = user_id and temporada = public.temporada_actual());

create policy "totales públicos" on public.me_gusta_totales
  for select to anon, authenticated
  using (true);

revoke all on public.me_gusta from anon;
revoke update, truncate, references, trigger on public.me_gusta from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.me_gusta_totales from anon, authenticated;

-- Mantiene el contador al dar o sacar un me gusta (no se cuenta en cada lectura).
create or replace function public.me_gusta_contar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.me_gusta_totales (playa, temporada, total)
    values (new.playa, new.temporada, 1)
    on conflict (playa, temporada) do update set total = public.me_gusta_totales.total + 1;
    return new;
  else
    update public.me_gusta_totales set total = greatest(total - 1, 0)
    where playa = old.playa and temporada = old.temporada;
    return old;
  end if;
end;
$$;
revoke execute on function public.me_gusta_contar() from public, anon, authenticated;

create trigger me_gusta_contar
after insert or delete on public.me_gusta
for each row execute function public.me_gusta_contar();

-- Estado de una playa para la cuenta actual: si le di me gusta y los totales.
create or replace function public.estado_me_gusta(p_playa text)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select json_build_object(
    'meGusta', exists (
      select 1 from public.me_gusta
      where playa = p_playa and temporada = public.temporada_actual() and user_id = (select auth.uid())
    ),
    'temporada', coalesce((
      select total from public.me_gusta_totales
      where playa = p_playa and temporada = public.temporada_actual()
    ), 0),
    'siempre', coalesce((select sum(total) from public.me_gusta_totales where playa = p_playa), 0)
  );
$$;

-- Da o saca el me gusta de la temporada actual y devuelve el estado nuevo (un solo viaje).
create or replace function public.alternar_me_gusta(p_playa text)
returns json
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.me_gusta
  where playa = p_playa and temporada = public.temporada_actual() and user_id = (select auth.uid());
  if not found then
    insert into public.me_gusta (playa) values (p_playa);
  end if;
  return public.estado_me_gusta(p_playa);
end;
$$;

revoke execute on function public.estado_me_gusta(text) from public, anon;
revoke execute on function public.alternar_me_gusta(text) from public, anon;
grant execute on function public.estado_me_gusta(text) to authenticated;
grant execute on function public.alternar_me_gusta(text) to authenticated;
