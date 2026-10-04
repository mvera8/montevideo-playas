-- El tope por cuenta dentro de la política de insert recursa sobre la misma tabla: va a un trigger.
drop policy "dar me gusta" on public.me_gusta;
create policy "dar me gusta" on public.me_gusta
  for insert to authenticated
  with check ((select auth.uid()) = user_id and temporada = public.temporada_actual());

create or replace function public.me_gusta_tope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.me_gusta where user_id = new.user_id and temporada = new.temporada) >= 60 then
    raise exception 'Tope de me gusta por temporada alcanzado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.me_gusta_tope() from public, anon, authenticated;

create trigger me_gusta_tope
before insert on public.me_gusta
for each row execute function public.me_gusta_tope();
