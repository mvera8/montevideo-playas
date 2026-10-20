-- Grants explícitos para no depender del auto-grant que Supabase deja de dar el 2026-10-30.
-- Reproduce exactamente los permisos que existen hoy en producción.

-- me_gusta: authenticated lee, inserta y borra sus propios me gusta (RLS filtra filas)
grant select, insert, delete on public.me_gusta to authenticated;

-- me_gusta_totales: lectura pública
grant select on public.me_gusta_totales to anon, authenticated;

-- service_role: acceso completo, como hoy
grant select, insert, update, delete, truncate, references, trigger
  on public.me_gusta, public.me_gusta_totales, public.playas,
     public.reportes, public.reporte_votos, public.errores
  to service_role;
