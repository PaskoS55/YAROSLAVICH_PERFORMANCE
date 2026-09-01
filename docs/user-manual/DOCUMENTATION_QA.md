# Documentation QA

## Проверки

- Источник: installed packaged Electron v1.0.0 — PASS.
- Размер кадров единообразный 1427×810 — PASS.
- Формат PNG — PASS.
- Терминал, браузерная рамка и Windows desktop отсутствуют — PASS.
- Demo явно маркирован на Demo-экранах — PASS.
- Реальные данные спортсменов не использованы — PASS.
- Password, Recovery Key, DB credentials, tokens не показаны — PASS; recovery keys закрыты в 048/054.
- Installation ID закрыт на всех добавленных кадрах — PASS; 061 обезличен.
- ProfileScore не назван percentile — PASS.
- Licensing описан как FROZEN / ENFORCEMENT OFF — PASS.
- Persistent `%LOCALAPPDATA%\PaskoPerformance` не спутан с Squirrel `%LOCALAPPDATA%\pasko_performance` — PASS.
- Продуктовый код/конфигурация не изменялись — PASS.

## Содержательная сверка

Руководство различает QC, soft-delete, cross-season goals, future-date bounds, Demo isolation, context-only reference coverage и транзакционную семантику Restore/Reset. Научные нормативы и отсутствующие протоколы не выдумывались.

## Phase 2 visual acceptance

- First Run: PASS.
- Login + invalid credentials: PASS.
- Recovery validation + recovery success: PASS.
- Player create: PASS.
- Backup → Reset → Restore через штатный React dialog: PASS.
- Restore Cancel/wrong phrase/password requirement/error/success: PASS.
- Restored player verification: PASS.
- Demo → Club return: PASS.
- Demo/production data isolation: PASS.
- Всего canonical PNG: 100.

## Итог

Документационный пакет пригоден как Markdown-руководство v1.0.0. PDF/DOCX намеренно не создавались. Продуктовый код, конфигурация и данные основной установки не изменялись.
