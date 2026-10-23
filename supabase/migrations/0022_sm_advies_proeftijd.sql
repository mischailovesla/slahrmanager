-- ============================================================
-- SLA HR Dashboard - migratie 0022 (v0.29.0): advies store manager ook over de proeftijd
-- hr_sm_advies krijgt een soort: 'verlenging' (contract loopt af) of 'proeftijd' (proeftijd loopt af).
-- Bij soort 'proeftijd' is contract_eind = laatste dag van de proeftijd (jjjj-mm-dd).
-- ============================================================
alter table hr_sm_advies add column if not exists soort text not null default 'verlenging';
alter table hr_sm_advies drop constraint if exists hr_sm_advies_soort_check;
alter table hr_sm_advies add constraint hr_sm_advies_soort_check check (soort in ('verlenging','proeftijd'));
alter table hr_sm_advies drop constraint if exists hr_sm_advies_medewerker_id_contract_eind_key;
alter table hr_sm_advies drop constraint if exists hr_sm_advies_uniek;
alter table hr_sm_advies add constraint hr_sm_advies_uniek unique (medewerker_id, contract_eind, soort);
