# Documentation findings — PASKO Performance v1.0.0

Проверка выполняется для release commit `c38241e753ddd1c70eebbcd17162b3d6d14b4d80` и installer `PASKO-Performance-Volleyball-Setup-1.0.0.exe` с SHA-256 `20dced21d7fdb9f0c8ff0b05200acce52073b0ef5013695350cd3fcdaf0770e4`.

## RESOLVED

### DOC-TOOL-001 — Ошибка определения already-running Electron instance

- **Классификация:** RESOLVED — documentation launch-detection issue.
- **Screen/route:** запуск packaged Desktop application.
- **Environment:** установленная PASKO Performance v1.0.0; Electron multi-process application с уже работающим главным окном.
- **Исходное наблюдение:** дополнительный `PaskoPerformance.exe` завершался с exit code `0`, а средство документации не находило новое окно.
- **Причина:** приложение уже было запущено; single-instance lifecycle корректно не создавал второе главное окно. Завершение дополнительного процесса не доказывало отказ продукта.
- **Проверка:** существующее окно найдено по exact executable path и title `PASKO PERFORMANCE PLATFORM — VOLLEYBALL`; Login и Dashboard ранее проверены вручную, GUI attach и window-only capture выполнены успешно.
- **User impact:** отсутствует.
- **Screenshot ID:** `001-dashboard-club-test.png`.
- **Notes:** находка не является product defect и не учитывается как BLOCKER/HIGH/MEDIUM/LOW.

## BLOCKER

Нет подтверждённых находок.

## HIGH

Нет подтверждённых находок.

## MEDIUM

Нет подтверждённых находок.

## LOW

Нет подтверждённых находок.

## DOCUMENTATION ISSUE

### DOC-UX-002 — Demo Import открывает raw JSON error

- **Классификация:** DOCUMENTATION/UX, non-blocking.
- **Screen/route:** Demo Workspace → «Импорт».
- **Наблюдение:** переход показывает сырой JSON `Операция недоступна в демонстрационном пространстве` вместо оформленного экрана приложения.
- **Функциональная безопасность:** операция корректно запрещена; production DB не изменяется.
- **Рекомендация:** оставить server-side deny и показывать стилизованное in-app уведомление/disabled state.
- **Screenshot ID:** `090-demo-import.png`.

### DOC-UX-003 — Ошибка Restore при неверном локальном пароле

- **Классификация:** ожидаемая validation/error state.
- **Наблюдение:** Restore не выполняется без точного подтверждения и действующего пароля локального администратора.
- **Проверка:** после ввода корректного синтетического пароля тот же backup успешно восстановлен; см. `071–073`.
