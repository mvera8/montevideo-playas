-- Endurecimiento después de revisar las RLS (10/2026).
--
-- 1) Lista de playas válidas. Antes `playa` solo se validaba con una regex, así que cualquier cuenta
--    anónima podía dar me gusta a 'playa-inventada' y aparecía en `me_gusta_totales`, que es pública.
--    Ahora me_gusta, me_gusta_totales y reportes apuntan a `playas` con una foreign key.
--    Misma lista que NOMBRES_PLAYA en src/lib/playas.ts (slug = slugify(nombre)): agregar acá
--    cualquier playa nueva que se sume allá, si no los me gusta de esa playa fallan.
--
-- 2) Permisos por defecto. Supabase le da todo a anon/authenticated en cada tabla, secuencia y
--    función nueva de `public`; con eso, una tabla nueva sin RLS queda abierta a la API. Desde acá
--    cada migración tiene que dar los permisos que necesite con `grant` explícito (ya lo hacían todas).

create table public.playas (
  slug text primary key check (char_length(slug) <= 40 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null
);

insert into public.playas (slug, nombre) values
  ('punta-espinillo', 'Punta Espinillo'),
  ('la-colorada', 'La Colorada'),
  ('pajas-blancas', 'Pajas Blancas'),
  ('zabala', 'Zabala'),
  ('los-cilindros', 'Los Cilindros'),
  ('punta-yeguas', 'Punta Yeguas'),
  ('santa-catalina', 'Santa Catalina'),
  ('del-nacional', 'Playa del Nacional'),
  ('del-cerro', 'Playa del Cerro'),
  ('ramirez', 'Ramírez'),
  ('pocitos', 'Pocitos'),
  ('buceo', 'Buceo'),
  ('malvin', 'Malvín'),
  ('brava', 'Playa Brava'),
  ('honda', 'Playa Honda'),
  ('los-ingleses', 'Los Ingleses'),
  ('verde', 'Playa Verde'),
  ('la-mulata', 'La Mulata'),
  ('carrasco', 'Carrasco');

-- Solo la usan las foreign keys (que no pasan por RLS): no se expone a la API.
alter table public.playas enable row level security;
revoke all on public.playas from anon, authenticated;

alter table public.me_gusta
  add constraint me_gusta_playa_fkey foreign key (playa) references public.playas (slug);
alter table public.me_gusta_totales
  add constraint me_gusta_totales_playa_fkey foreign key (playa) references public.playas (slug);
alter table public.reportes
  add constraint reportes_playa_fkey foreign key (playa) references public.playas (slug);

-- Nada nuevo en `public` queda abierto solo por existir.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- Postgres además da EXECUTE a PUBLIC en toda función nueva (y anon lo hereda).
alter default privileges for role postgres
  revoke execute on functions from public;
