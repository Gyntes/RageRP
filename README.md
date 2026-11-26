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

В разработке

## Сборка ядра

```powershell
cd D:\RageRP
dotnet sln RageRP.sln add src\RageRP.Core\RageRP.Core.csproj
dotnet build RageRP.sln
```
