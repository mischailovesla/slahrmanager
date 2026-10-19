-- ============================================================
-- HR Dashboard ← Academy: één leesfunctie (fase 4a, v0.18.0)
--
-- LET OP: dit draai je in het ACADEMY-project (Supabase "training", xiyyyminsswiucnluxbf),
-- NIET in "SLA HR Manager". Eenmalig plakken in de SQL-editor en op Run drukken.
--
-- Wat het doet:
--  * tabel hr_koppeling met alleen de sha-256-hash van een geheime sleutel (RLS aan, geen policies)
--  * functie hr_training_status(p_sleutel) — geeft per actieve medewerker een samenvatting terug:
--    certificaten (geldig t/m), welkomstcollectie (af/totaal + wat nog open staat), verplichte
--    observaties (aftekenplicht), laatst ingelogd. Geen quizantwoorden, PIN's of andere details.
--  * maakt een nieuwe sleutel aan en toont die ÉÉN keer in het resultaat → kopieer naar Netlify
--    (HR Dashboard) als omgevingsvariabele ACADEMY_HR_SLEUTEL.
--
-- Opnieuw draaien mag: de functie wordt vervangen en er komt een nieuwe sleutel (de oude werkt dan niet meer).
-- Sleutel intrekken: delete from public.hr_koppeling;
-- ============================================================

create table if not exists public.hr_koppeling (
  id int primary key default 1 check (id = 1),
  sleutel_hash text not null,
  aangemaakt_op timestamptz not null default now(),
  laatst_gebruikt timestamptz
);
alter table public.hr_koppeling enable row level security;
revoke all on public.hr_koppeling from anon, authenticated;
comment on table public.hr_koppeling is 'HR Dashboard (slahrmanager.netlify.app): sha-256 van de sleutel voor hr_training_status(). Eén rij.';

create or replace function public.hr_training_status(p_sleutel text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r jsonb;
begin
  if p_sleutel is null or length(p_sleutel) < 32 or not exists (
    select 1 from public.hr_koppeling where sleutel_hash = encode(sha256(convert_to(p_sleutel, 'UTF8')), 'hex')
  ) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  update public.hr_koppeling set laatst_gebruikt = now() where id = 1;

  with emp as (
    select e.id, e.shiftbase_id, e.full_name, lower(e.email) as email, e.role, e.start_date,
           e.welcome_mail_sent_at, l.name as locatie, l.academy_live, l.academy_live_since,
           (select max(u.last_sign_in_at) from auth.users u
             where u.id = e.auth_user_id or lower(u.email::text) = lower(e.email)) as laatst_ingelogd
      from public.employees e
      left join public.locations l on l.id = e.location_id
     where e.active and coalesce(e.role, '') <> 'extern'
  ),
  cert as (
    select employee_id,
           jsonb_agg(jsonb_build_object('titel', training_title, 'status', status, 'geldig_tot', valid_until, 'dagen', days_left) order by training_title) as c
      from (select distinct on (employee_id, group_key) *
              from public.v_training_validity
             where validity_months is not null
             order by employee_id, group_key,
                      case status when 'geldig' then 0 when 'verloopt_binnenkort' then 1 when 'verlopen' then 2 when 'bezig' then 3 else 4 end) x
     group by employee_id
  ),
  welk as (
    select employee_id,
           count(distinct training_id) as totaal,
           count(distinct training_id) filter (where afgerond) as af,
           coalesce(jsonb_agg(distinct title) filter (where not afgerond), '[]'::jsonb) as open
      from public.v_toewijzing_voortgang
     where bron = 'auto'
     group by employee_id
  ),
  aft as (
    select employee_id,
           jsonb_agg(jsonb_build_object('observatie', observatie, 'status', status, 'deadline', deadline, 'op', laatst_op::date) order by sort_order) as a
      from public.v_aftekenplicht
     where verplicht or status in ('afgetekend', 'verlopen', 'niet_geslaagd')
     group by employee_id
  ),
  trn as (
    select employee_id,
           count(distinct group_key) as totaal,
           count(distinct group_key) filter (where status in ('geldig', 'verloopt_binnenkort')) as af
      from public.v_training_validity
     group by employee_id
  )
  select jsonb_build_object(
           'stand', now(),
           'medewerkers', coalesce(jsonb_agg(jsonb_build_object(
              'id', emp.id, 'shiftbase_id', emp.shiftbase_id, 'naam', emp.full_name, 'email', emp.email,
              'rol', emp.role, 'locatie', emp.locatie, 'academy_live', emp.academy_live, 'live_sinds', emp.academy_live_since,
              'start', emp.start_date, 'welkom_mail', emp.welcome_mail_sent_at::date, 'laatst_ingelogd', emp.laatst_ingelogd::date,
              'certificaten', coalesce(cert.c, '[]'::jsonb),
              'welkom', jsonb_build_object('totaal', coalesce(welk.totaal, 0), 'af', coalesce(welk.af, 0), 'open', coalesce(welk.open, '[]'::jsonb)),
              'aftekenen', coalesce(aft.a, '[]'::jsonb),
              'trainingen', jsonb_build_object('totaal', coalesce(trn.totaal, 0), 'af', coalesce(trn.af, 0))
           ) order by emp.full_name), '[]'::jsonb))
    into r
    from emp
    left join cert on cert.employee_id = emp.id
    left join welk on welk.employee_id = emp.id
    left join aft  on aft.employee_id  = emp.id
    left join trn  on trn.employee_id  = emp.id;
  return r;
end
$$;

revoke all on function public.hr_training_status(text) from public;
grant execute on function public.hr_training_status(text) to anon, authenticated;
comment on function public.hr_training_status(text) is 'HR Dashboard: samenvatting trainingen/certificaten/aftekenen per actieve medewerker. Alleen met de sleutel uit hr_koppeling.';

-- Nieuwe sleutel maken en één keer tonen. Kopieer de waarde naar Netlify → HR Dashboard → ACADEMY_HR_SLEUTEL.
with k as (select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as s),
     ins as (
       insert into public.hr_koppeling (id, sleutel_hash, aangemaakt_op, laatst_gebruikt)
       select 1, encode(sha256(convert_to(s, 'UTF8')), 'hex'), now(), null from k
       on conflict (id) do update set sleutel_hash = excluded.sleutel_hash, aangemaakt_op = now(), laatst_gebruikt = null
       returning id
     )
select k.s as "ACADEMY_HR_SLEUTEL (kopieer naar Netlify)" from k, ins;
