-- v0.25.8: Jop (toezicht keuken) krijgt toegang met rol 'keuken': alleen de takenlijst met keukenmedewerkers
insert into public.hr_toegang (email, naam, rol, actief, aangemaakt_door)
values ('jop@ilovesla.com', 'Jop', 'keuken', true, 'mischa@ilovesla.com')
on conflict (email) do update set rol = 'keuken', actief = true;
