# Передача контекста: разработка карты Тулы

Дата: 26 ноября 2026 года
Рабочий каталог: `F:\servGTA`

## Цель и решения команды

- Сервер GTA V RP на RAGE MP для РФ и СНГ.
- Команда из трёх человек, в работе планируется активно использовать ИИ.
- Приоритет — серьёзный roleplay; игрокам доступен свободный выбор ролей.
- Монетизация — только косметические элементы; бюджет пока не определён.
- Карта должна быть компактной игровой версией Тулы и заменить весь мир GTA V, а не занимать часть Лос-Сантоса.

## Что уже создано

- [`../map/tula_control_points.geojson`](../map/tula_control_points.geojson) — 7 ориентировочных контрольных точек WGS84.
- [`../map/tula_center_detailed.svg`](../map/tula_center_detailed.svg) — детальный план улиц и застройки из OSM с подписями контрольных ориентиров.
- [`../map/tula_center_features.geojson`](../map/tula_center_features.geojson) — 6 541 GIS-объект: 2 405 линий, 590 точек, 3 546 полигонов.
- [`../map/tula_center_greybox.obj`](../map/tula_center_greybox.obj) + [`../map/tula_center_greybox.mtl`](../map/tula_center_greybox.mtl) — первый 3D greybox: 3 090 объёмных зданий, 9 277 дорожных сегментов, 77 889 вершин и 33 679 граней.
- [`../map/source/tula_center.osm`](../map/source/tula_center.osm) — исходные данные OSM: 32 172 узла, 6 768 ways, 489 relations.
- [`../map/tula_compact_blockout.svg`](../map/tula_compact_blockout.svg) — ранняя концептуальная схема; детальная SVG предпочтительнее для просмотра улиц.
- [`../map/tula_pilot_manifest.json`](../map/tula_pilot_manifest.json) — единая спецификация предложенной пилотной зоны и локальной системы координат.
- [`../map/validate_tula_map.ps1`](../map/validate_tula_map.ps1) — локальная проверка OSM, GeoJSON, SVG, OBJ/MTL и manifest.
- [`../map/source/tula_pilot.osm`](../map/source/tula_pilot.osm) — объединённая пилотная выгрузка по bbox `37.55,54.17,37.64,54.21`: 72 949 узлов и 15 657 ways.
- [`../map/tula_pilot_features.geojson`](../map/tula_pilot_features.geojson) + [`../map/tula_pilot_detailed.svg`](../map/tula_pilot_detailed.svg) — расширенная GIS-база пилотной зоны.
- [`../map/tula_pilot_greybox.obj`](../map/tula_pilot_greybox.obj) + [`../map/tula_pilot_greybox.mtl`](../map/tula_pilot_greybox.mtl) + [`../map/tula_pilot_greybox.blend`](../map/tula_pilot_greybox.blend) — 3D-greybox пилота: 9 671 building, 5 646 road segment, 340 rail segment.
- [`../map/tula_pilot_greybox_compact.obj`](../map/tula_pilot_greybox_compact.obj) + [`../map/tula_pilot_greybox_compact.blend`](../map/tula_pilot_greybox_compact.blend) — компактный 3D-greybox с горизонтальным масштабом 0.5; вертикальные высоты пока не масштабированы.
- [`../map/tula_pilot_compact_manifest.json`](../map/tula_pilot_compact_manifest.json) — единая формула локального преобразования WGS84 в метры и параметры компактного пилота.
- [`../map/convert_tula_pilot_coordinates.ps1`](../map/convert_tula_pilot_coordinates.ps1) — конвертер контрольных WGS84-точек в local/temporary GTA world coordinates.
- [`../server/resources/tula_pilot_map/stream/tula_pilot_greybox.ydr`](../server/resources/tula_pilot_map/stream/tula_pilot_greybox.ydr), `.ytyp` и `.ymap` — native GTA asset pilot для RAGE MP.

Greybox использует локальную систему координат: начало — `37.6175 E, 54.1930 N`, X на восток, Y на север, Z вверх; единицы — метры, пока в масштабе 1:1. У высот зданий без данных задана условная высота 8 м. Рельеф плоский; мосты, туннели, коллизии, интерьеры, LOD и оптимизация ещё не сделаны. Это **не готовая игровая карта**.

## Ограничения текущих геоданных

- Запрошенный bbox OSM: `37.60,54.18,37.64,54.205`. Из-за полных линий way геометрия на SVG простирается примерно на 6.8 × 7.9 км, но области за исходным bbox не являются полной выгрузкой.
- Multipolygon relations и отверстия полигонов пока не реконструированы. Для полного игрового покрытия нужен корректный районный extract с атрибуцией.
- OSM: © OpenStreetMap contributors, лицензия ODbL 1.0. Сохранять атрибуцию и проверять требования ODbL для производных данных.
- Описание источника и допущений: [`../map/source/README.md`](../map/source/README.md); допущения 3D-модели: [`../map/tula_center_greybox_README.md`](../map/tula_center_greybox_README.md).

## Текущее состояние репозитория и инструментов

- Ветка `main` совпадала с `origin/main` до начала работы над картой. Сейчас `docs/` и `map/` неотслеживаемые; изменения не коммитились и не отправлялись в GitHub.
- Проект обновлен с GitHub до актуального `main`/`origin/main` (коммит `1882848`). Изменения папок `docs/` и `map/` сохранены как незакоммиченные локальные файлы.
- Blender установлен в `F:\Blander` и проверен как Blender 5.3.0. Текущий greybox OBJ успешно импортирован в headless Blender: 4 объекта в сцене, 2 mesh-объекта.
- CodeWalker source клонирован в `tools/CodeWalker` и собран как x64/net48 executable: `tools/CodeWalker/CodeWalker/bin/x64/Release/net48/win7-x64/CodeWalker.exe`.
- В `server/resources/ragerp/index.js` до сих пор стартовая точка Лос-Сантоса (`215.76, -810.12, 30.73`). Не менять её, пока не готов игровой map asset и точное преобразование координат.
- В `README.md` сказано, что `server/server-files` установлены, но папки в рабочем каталоге нет.
- В PATH не найдены Blender, QGIS, Node.js/npm, .NET SDK, `csc` или `msbuild`. Прямой запуск `.ps1` блокируется локальной Execution Policy; синтаксис [`../map/build_tula_map.ps1`](../map/build_tula_map.ps1) проверен, но запуск из файла не проверялся. GeoJSON, SVG и OBJ уже созданы и проверены отдельно.
- Игровой ресурс работает на Node.js внутри RAGE MP, но клиентская упаковка кастомных карт и игровой тест ещё не настроены.

## Рекомендуемое продолжение

1. Расширить и корректно получить OSM-источник для всей компактной игровой территории: центр, вокзал, парк, жилые и промышленные зоны, пригороды и связные подъезды. Не трактовать текущий bbox как полную карту.
2. Открыть OBJ в Blender и проверить геометрию; затем добавить рельеф, высоты, правильные берега/мосты, разделение на тайлы, коллизии и оптимизацию.
3. Определить целевую игровую область и преобразование локальных метров в координаты мира GTA V. Не фиксировать игровой масштаб на глаз.
4. Выбрать и настроить проверяемый конвейер игровых ассетов RAGE MP (например, Blender плюс совместимый инструмент подготовки GTA map assets). Установить/подготовить серверные файлы и клиентскую структуру ресурсов.
5. Только после этого собрать маленький игровой proof of concept, временно скрыть/заменить исходную геометрию на выбранном участке и проверить дороги, высоты, стриминг и spawn.
6. После успешного теста продолжать блок-аут до полного замещения мира GTA V, затем создавать фасады, интерьеры и RP-локации.

## Стартовый текст для следующего чата

> Продолжай разработку карты Тулы в проекте `F:\servGTA`. Решения команды: компактная игровая Тула должна полностью заменить карту GTA V. Прочитай `docs/Tula_Map_Handoff.md`, `docs/Tula_Map_Research.md` и `map/tula_center_greybox_README.md`, затем осмотри файлы в `map/`. Уже есть OSM-фрагмент, детальная SVG/GeoJSON-карта и проверенный OBJ/MTL greybox центра; это не игровые ассеты. Сохраняй изменения команды, не перемещай spawn с Лос-Сантоса без готовых ассетов и не называй блок-аут готовой картой. Сначала определи доступный конвейер подготовки RAGE MP map assets и расширь GIS-охват за пределы текущего центрального bbox; сохраняй OSM attribution/ODbL.
