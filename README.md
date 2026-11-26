# RageMP RP

Базовый каркас RP-сервера на C# для RageMP.

## Состав первого MVP

- аккаунт по Social Club ID;
- создание персонажа;
- наличные и банковский счёт;
- фракция и профессия;
- JSON-хранилище аккаунтов;
- денежный перевод наличных в банк.

## Текущий статус

В разработке. Официальные Windows server-files установлены в `server\server-files`. Запускной файл копирует
ресурс из `server\resources\ragerp` и конфигурацию из `server\conf.json`, затем запускает
RageMP на `127.0.0.1:22005`.

1. Запусти `server\start-server.bat`.
2. Открой RageMP и подключись к `127.0.0.1:22005`.
3. В игре введи `/register Alex Morgan 25`, затем `/help`.

Доступны регистрация персонажа, сохранение прогресса, локальное `/me`, счета и переводы
`/deposit` и `/withdraw`, профессия курьера (`/job courier`, `/work`) и фракции Civilian/Mechanic.
Для сохранения прогресса аккаунт привязан к Social Club ID (если сервер его сообщает).
Серверный runtime включает NodeJS, а C# bridge в этой сборке выключен; поэтому игровой
ресурс реализован на JavaScript, а `RageRP.Core` пока остаётся отдельной библиотекой.
Бинарные файлы RageMP намеренно исключены из Git; перед запуском у других разработчиков
должна быть собственная серверная сборка в `server\server-files`.

## Сборка ядра

```powershell
cd D:\RageRP
dotnet sln RageRP.sln add src\RageRP.Core\RageRP.Core.csproj
dotnet build RageRP.sln
```
