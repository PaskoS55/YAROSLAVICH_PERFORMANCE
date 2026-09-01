# Покрытие пользовательских экранов

| Область | Состояния | Кадры | Статус |
|---|---|---|---|
| Shell / Dashboard | Club empty, Demo populated, top/bottom | 001–006 | PASS |
| Team/Season context | selector, create forms | 003–004, 034–035 | PASS |
| Players | populated, empty, create, validation, profile | 007–011, 038–040 | PASS |
| Body Composition | list, new measurement | 012–013 | PASS |
| Goals | list/statuses, create | 014–015 | PASS |
| Team Testing | setup, input table | 016–017 | PASS |
| Sessions | list, detail, results | 018–020 | PASS |
| Analytics / Profile | radar, coverage, history, empty trend | 008–011, 021–022 | PASS |
| Compare | populated comparison | 023 | PASS |
| Reports | overview | 024 | PASS |
| Import | Demo restriction | 025 | PARTIAL — Club file flow не выполнялся |
| QC | overview | 027 | PARTIAL — destructive resolve не выполнялся |
| Tests | catalog | 028 | PARTIAL — edit/save не выполнялись |
| References | catalog | 029 | PARTIAL — clone/edit не выполнялись |
| Protocols | catalog | 030 | PASS |
| Equipment | catalog | 031 | PARTIAL — mutation не выполнялась |
| Settings | Demo/Club, team, season, license, security | 032–036 | PASS |
| Diagnostics | health and restore points | 037 | PASS, sensitive ID redacted |
| Backup/Restore/Reset | warning, typed confirmation, password, success, restored data | 062–073 | PASS — isolated UI roundtrip |
| Login/Logout/Recovery | login, invalid credentials, recovery validation and success | 050–055 | PASS — recovery keys redacted |
| First Run | welcome, club, validation, team, season, administrator, recovery, complete | 041–049 | PASS — isolated installation |
| Demo extended | dashboard, players, body composition, goals, testing, sessions, analytics, compare, reports, QC | 074–093 | PASS |
| References / Protocols / Equipment | scientific coverage, protocol expansion, empty/add states | 094–100 | PASS |
| Demo settings / return to club | reset explanation and isolated return | 101–102 | PASS |

## Изолированная сессия Phase 2

First Run, Login, Recovery и Backup → Reset → Restore проверены в отдельном `PASKO_E2E_MODE=1` data root. Production data root не открывался и не изменялся. Backup/Restore roundtrip восстановил игрока и системные справочники; временные пароли, recovery keys и Installation ID в документацию не включены.
