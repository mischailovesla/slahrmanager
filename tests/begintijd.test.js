// v0.57.0: inkloktijd uit Shiftbase bewaren en 'te laat begonnen' berekenen
const assert = require('assert');
const E = require('../netlify/functions/_lib/eindtijd');
const d = E.vanApi({
  users: [{ User: { id: 1, first_name: 'Tanya', last_name: 'Test' } }],
  teams: [{ Team: { id: 7, department_id: 'D1', name: 'SLA Westerstraat' } }],
  rosters: [
    { Roster: { id: 10, date: '2026-11-16', starttime: '09:30:00', endtime: '17:30:00', total: 7.5, department_id: 'D1' }, Shift: { long_name: 'SLA-maker (Opener)' } },
    { Roster: { id: 11, date: '2026-11-17', starttime: '09:30:00', endtime: '14:30:00', total: 5, department_id: 'D1' } },
    { Roster: { id: 12, date: '2026-11-18', starttime: '23:30:00', endtime: '04:00:00', total: 4, department_id: 'D1' } },
    { Roster: { id: 13, date: '2026-11-19', starttime: '17:00:00', endtime: '22:00:00', total: 5, department_id: 'D1' } }
  ],
  timesheets: [
    { Timesheet: { user_id: 1, date: '2026-11-16', roster_id: 10, team_id: 7, clocked_in: '2026-11-16 09:33:36', clocked_out: '2026-11-16 17:15:00', status: 'Approved', total: 7.7 } },
    { Timesheet: { user_id: 1, date: '2026-11-17', roster_id: 11, team_id: 7, clocked_in: '2026-11-17 09:29:00', clocked_out: '2026-11-17 14:32:00', status: 'Approved' } },
    { Timesheet: { user_id: 1, date: '2026-11-18', roster_id: 12, team_id: 7, clocked_in: '2026-11-19 00:10:00', clocked_out: '2026-11-19 04:00:00', status: 'Approved' } },
    { Timesheet: { user_id: 1, date: '2026-11-19', roster_id: 13, team_id: 7, starttime: '17:00:00', endtime: '22:00:00', status: 'Pending' } },
    { Timesheet: { user_id: 1, date: '2026-11-20', team_id: 7, clocked_in: '2026-11-20 10:00:00', status: 'Approved' } } // zonder rooster: telt niet mee
  ]
});
const b = E.beginAnalyse(d, { winkels: { D1: { code: 'WS', naam: 'Westerstraat' } } });
const m = b.winkels.WS[0];
assert.strictEqual(m.aantal, 4);
const per = Object.fromEntries(m.diensten.map(x => [x.datum, x]));
assert.strictEqual(per['2026-11-16'].laat, 3);                  // 09:33:36 → 3 min
assert.strictEqual(per['2026-11-16'].dienst, 'SLA-maker (Opener)');
assert.strictEqual(per['2026-11-17'].laat, -1);                 // eerder ingeklokt
assert.strictEqual(per['2026-11-18'].laat, 40);                 // over middernacht
assert.strictEqual(per['2026-11-19'].zonderInklok, true);
assert.strictEqual(m.aantalLaat, 2); assert.strictEqual(m.aantalDrempel, 1); assert.strictEqual(m.ochtendLaat, 0);
assert.strictEqual(m.zonderInklok, 1); assert.strictEqual(m.pctOpTijd, 33);
assert.strictEqual(per['2026-11-16'].ochtend, true);
// eindtijd-analyse blijft werken met dezelfde diensten
assert.ok(E.analyseer(d, { winkels: { D1: { code: 'WS', naam: 'Westerstraat' } } }));
console.log('begintijd: OK');
