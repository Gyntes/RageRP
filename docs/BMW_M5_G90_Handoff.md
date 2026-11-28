# Передача контекста: BMW M5 G90 для RAGE:MP

Дата: 28 ноября 2026 года
Рабочий каталог: `C:\servGTA5`

## Цель

Подготовить BMW M5 G90 2025 для локального тестирования на GTA 5 RP-сервере RAGE:MP. За основу взята предоставленная пользователем модель из `C:\скрины Патрики\2025-bmw-m5-g90\source\2025-bmw-m5-sedan`. Рабочие файлы моделей следует хранить в `modelavto`.

## Что сделано

- Собран YFT-фрагмент автомобиля: [`modelavto/bmw_m5_g90_yft_build/stream/gen8/bmwm5g90.yft`](../modelavto/bmw_m5_g90_yft_build/stream/gen8/bmwm5g90.yft).
- Обновлён локальный DLC-пакет RAGE:MP: [`server/client_packages/game_resources/dlcpacks/bmwm5g90/dlc.rpf`](../server/client_packages/game_resources/dlcpacks/bmwm5g90/dlc.rpf).
- В исходном салоне отделён руль и привязан к стандартной кости GTA `steeringwheel`. Сцена сборки: [`modelavto/bmw_m5_g90_yft_build/bmwm5g90_fragment.blend`](../modelavto/bmw_m5_g90_yft_build/bmwm5g90_fragment.blend).
- Проверка YFT выявила 18 костей, 11 physics-групп, 4 wheel drawables, 6 panel drawables, один skinned drawable руля, 29 встроенных текстур и 34 geometry entries.
- Существующие в исходнике интерьер и emissive-текстуры экранов сохранены. Изображения на 3D-экранах статичны; живые показания выводятся отдельным CEF-слоем.
- Добавлены серверное сохранение топлива и заправка у стандартных GTA V АЗС по клавише E. Заправку оплачивает только владелец аккаунта. Начальные тестовые настройки: расход 0,45 процентного пункта в минуту при работающем двигателе, цена 25 ₽ за процент топлива.
- Основной спидометр обновлён по первому референсу; показывает текущую скорость, пробег с десятыми километра, загрязнение и состояние двигателя. Уровень топлива показан участком по дуге спидометра.
- Пробег и грязь сохраняются по моделям Blista/BMW в аккаунте. Грязь растёт на 1 уровень за километр и сбрасывается за 500 ₽ на стандартных автомойках GTA V по E при выключенном двигателе.
- Сохранена CEF-приборка с передачей и оборотами; настроены сигналы поворота и аварийка.
- Административная команда для тестового спавна: `/bmwm5g90`.

## Основные файлы

- Экспортёр и проверка: [`modelavto/export_downloaded_bmw_yft.py`](../modelavto/export_downloaded_bmw_yft.py), [`modelavto/verify_bmw_m5_yft.py`](../modelavto/verify_bmw_m5_yft.py).
- Инструкции по сборке: [`modelavto/BMW_M5_G90_RAGE_MP_BUILD.txt`](../modelavto/BMW_M5_G90_RAGE_MP_BUILD.txt).
- Серверная логика: [`server/resources/ragerp/index.js`](../server/resources/ragerp/index.js), [`server/resources/ragerp/vehicle_fuel.js`](../server/resources/ragerp/vehicle_fuel.js).
- Клиент и CEF: [`server/client_packages/ragerp/index.js`](../server/client_packages/ragerp/index.js), [`server/client_packages/ragerp/dashboard/`](../server/client_packages/ragerp/dashboard/).
- Тесты: [`tests/vehicle_fuel.test.js`](../tests/vehicle_fuel.test.js).
- Документация приборки: [`docs/BMW_M5_G90_Dashboard.md`](BMW_M5_G90_Dashboard.md).

## Проверки и ограничения

- YFT прошёл Blender/Sollumz round-trip; упакованный ресурс из DLC восстановлен и разобран для проверки.
- До текущих изменений проходили 7 тестов топливной логики и проверки синтаксиса JS. Для текущих изменений добавлены тесты пробега, загрязнения и форматирования одометра; запустить их в этой среде не удалось, поскольку Node.js отсутствует. `git diff --check` прошёл, CEF проверен в браузере на примерах Blista и BMW M5.
- Сервер и игровой RAGE:MP-клиент для текущих изменений не запускались. Не подтверждены в игре загрузка DLC, вращение руля и колёс, анимация дверей/капота/багажника, сетевые сигналы, синхронизация грязи, пробега и работа автомойки/заправки.
- YFT содержит один high-detail LOD. Наличие костей и панелей в модели не доказывает, что игровая анимация уже работает.
- Координаты АЗС и игровые нативные вызовы требуют проверки в клиенте.
- Production/VPS не запускался и не менялся. Реализация предназначена для RAGE:MP; FiveM не настраивался.

## Рекомендуемое продолжение

1. Использовать локальный или staging-сервер RAGE:MP, не production.
2. Загрузить обновлённый DLC и проверить команду `/bmwm5g90` с аккаунта администратора.
3. Проверить модель, коллизии, колёса, руль, все панели, приборку, сигналы и заправку в игре.
4. Исправлять только подтверждённые проблемы; при необходимости отдельно согласовать значения расхода и цены топлива.

## Стартовый текст для следующего чата

> Продолжай работу над BMW M5 G90 2025 для RAGE:MP в `C:\servGTA5`. Сначала прочитай `docs/BMW_M5_G90_Handoff.md`, `docs/BMW_M5_G90_Dashboard.md` и `modelavto/BMW_M5_G90_RAGE_MP_BUILD.txt`. Готовые YFT и DLC находятся в `modelavto/bmw_m5_g90_yft_build/stream/gen8/bmwm5g90.yft` и `server/client_packages/game_resources/dlcpacks/bmwm5g90/dlc.rpf`. Сборка и unit-тесты прошли, но RAGE:MP-клиент и сервер ещё не запускались: фактические игровые анимации, DLC, сигналы и заправку нужно проверить локально. Не затрагивай production/VPS без явного разрешения и не смешивай API RAGE:MP с FiveM.
