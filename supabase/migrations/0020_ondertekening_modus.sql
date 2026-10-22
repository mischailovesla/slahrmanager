-- v0.26.0: ondertekenen uitgebreid met
--   * oproepaanbod: de medewerker kiest bij het tekenen 'aanvaard' of 'afgewezen' (keuze)
--   * waarschuwing en beschikbaarheidsbrief: 'voor gezien' tekenen, met optionele reactie (opmerking)
alter table hr_ondertekening add column if not exists keuze text;
alter table hr_ondertekening add column if not exists opmerking text;
