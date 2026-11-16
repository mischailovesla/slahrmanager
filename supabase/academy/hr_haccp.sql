-- ============================================================
-- HR Dashboard ← Academy: HACCP-naleving per winkel per dag (v0.50.0, 16-11-2026)
--
-- LET OP: dit draai je in het ACADEMY-project (Supabase "training", xiyyyminsswiucnluxbf),
-- NIET in "SLA HR Manager". Eenmalig plakken in de SQL-editor en op Run drukken.
-- Gebruikt dezelfde sleutel als hr_training_status (tabel hr_koppeling, Netlify ACADEMY_HR_SLEUTEL); er komt GEEN nieuwe sleutel.
--
-- hr_haccp_naleving(p_sleutel, p_van, p_tot) geeft per eigen winkel (geen franchise, geen keuken) en per dag elke
-- verplichte HACCP-lijst die die dag moest (dagelijks of wekelijks op vaste weekdagen, niet "mag later" / carry_over),
-- met status:
--   gemist = die dag niet afgerond (en niet op n.v.t. gezet)
--   laat   = wel afgerond, maar na de deadline van de lijst (due_before)
--   ok     = op tijd
-- Plus het tijdvak van de lijst (show_from - due_before), zodat het HR Dashboard het rooster uit Shiftbase ernaast kan leggen.
-- Alleen dagen vóór vandaag; maximaal 93 dagen per opvraag. Geen persoonsgegevens behalve wie een te late lijst afrondde.
-- ============================================================
create or replace function public.hr_haccp_naleving(p_sleutel text, p_van date, p_tot date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r jsonb;
  v_tot date := least(coalesce(p_tot, current_date - 1), (now() at time zone 'Europe/Amsterdam')::date - 1);
  v_van date := coalesce(p_van, v_tot - 27);
begin
  if p_sleutel is null or length(p_sleutel) < 32 or not exists (
    select 1 from public.hr_koppeling where sleutel_hash = encode(sha256(convert_to(p_sleutel, 'UTF8')), 'hex')
  ) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if v_tot - v_van > 92 then v_van := v_tot - 92; end if;
  update public.hr_koppeling set laatst_gebruikt = now() where id = 1;

  with loc as (
    select id, code, name, academy_live_since from public.locations
     where active and not coalesce(franchise, false) and kind = 'winkel'
  ),
  tpl as (
    select id, coalesce(nullif(short_name, ''), split_part(name, ' // ', 1)) as lijst, show_from, due_before, weekdays, start_date, location_kinds, owner_location_id
      from public.checklist_templates
     where status = 'gepubliceerd' and category = 'haccp' and coalesce(verplicht, true) and not coalesce(carry_over, false)
       and frequency in ('dagelijks', 'wekelijks')
  ),
  dag as (select generate_series(v_van, v_tot, interval '1 day')::date as d),
  verw as (
    select loc.id as location_id, loc.code, loc.name as winkel, dag.d as datum, tpl.id as template_id, tpl.lijst, tpl.show_from, tpl.due_before
      from loc cross join tpl cross join dag
     where 'winkel' = any(tpl.location_kinds)
       and (tpl.owner_location_id is null or tpl.owner_location_id = loc.id)
       and (tpl.weekdays is null or extract(dow from dag.d)::int = any(tpl.weekdays))
       and (tpl.start_date is null or dag.d >= tpl.start_date)
       and (loc.academy_live_since is null or dag.d >= loc.academy_live_since::date)
       and not exists (select 1 from public.checklist_template_exclusions x where x.template_id = tpl.id and x.location_id = loc.id)
  ),
  st as (
    select v.*, k.klaar, k.door
      from verw v
      left join lateral (
        select coalesce(r.completed_at, r.started_at) as klaar, e.full_name as door
          from public.checklist_runs r left join public.employees e on e.id = r.employee_id
         where r.template_id = v.template_id and r.location_id = v.location_id and r.run_date = v.datum
           and (r.completed_at is not null or coalesce(r.nvt, false))
         order by coalesce(r.completed_at, r.started_at) limit 1
      ) k on true
  ),
  st2 as (
    select st.*, case when klaar is null then 'gemist'
                      when due_before is not null and (klaar at time zone 'Europe/Amsterdam')::time > due_before then 'laat'
                      else 'ok' end as status
      from st
  )
  select jsonb_build_object(
    'stand', now(), 'van', v_van, 'tot', v_tot,
    'winkels', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'naam', name) order by name) from loc), '[]'::jsonb),
    'lijsten', coalesce((select jsonb_agg(jsonb_build_object(
        'datum', datum, 'code', code, 'winkel', winkel, 'lijst', lijst,
        'van', to_char(show_from, 'HH24:MI'), 'tot', to_char(due_before, 'HH24:MI'), 'status', status,
        'klaar', case when klaar is null then null else to_char(klaar at time zone 'Europe/Amsterdam', 'HH24:MI') end,
        'door', case when status = 'laat' then door end
      ) order by datum, code, lijst) from st2), '[]'::jsonb)
  ) into r;
  return r;
end
$$;

revoke all on function public.hr_haccp_naleving(text, date, date) from public;
grant execute on function public.hr_haccp_naleving(text, date, date) to anon, authenticated;
comment on function public.hr_haccp_naleving(text, date, date) is 'HR Dashboard: verplichte HACCP-lijsten per eigen winkel per dag (gemist/laat/ok) met tijdvak. Alleen met de sleutel uit hr_koppeling.';
