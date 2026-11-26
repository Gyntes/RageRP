using RageRP.Core;

var service = new RpService(Path.Combine(AppContext.BaseDirectory, "data"));
var account = service.Login("smoke-test", "Smoke");
var character = service.CreateCharacter("smoke-test", "Alex", "Morgan", 25);
var deposited = service.TransferCash("smoke-test", 500);

if (account.Character is null)
    throw new InvalidOperationException("Character was not attached to account.");

if (character.Cash != 4500 || character.Bank != 10500 || !deposited)
    throw new InvalidOperationException("RP economy smoke test failed.");

Console.WriteLine($"OK: {character.FirstName} {character.LastName}, cash={character.Cash}, bank={character.Bank}");
