using System.Text.Json;

namespace RageRP.Core;

public sealed class RpService
{
    private readonly string _dataDirectory;
    private readonly Dictionary<string, Account> _accounts = new(StringComparer.OrdinalIgnoreCase);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public RpService(string dataDirectory)
    {
        _dataDirectory = dataDirectory;
        Directory.CreateDirectory(_dataDirectory);
        Load();
    }

    public Account Login(string socialClubId, string name)
    {
        if (string.IsNullOrWhiteSpace(socialClubId))
            throw new ArgumentException("Social Club ID is required.", nameof(socialClubId));

        if (!_accounts.TryGetValue(socialClubId, out var account))
        {
            account = new Account
            {
                Name = name,
                SocialClubId = socialClubId
            };
            _accounts[socialClubId] = account;
            Save();
        }

        return account;
    }

    public Character CreateCharacter(
        string socialClubId,
        string firstName,
        string lastName,
        int age)
    {
        if (age is < 18 or > 100)
            throw new ArgumentOutOfRangeException(nameof(age), "Age must be between 18 and 100.");

        var account = Login(socialClubId, firstName);
        var character = new Character
        {
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Age = age
        };
        account.Character = character;
        Save();
        return character;
    }

    public bool TransferCash(string socialClubId, decimal amount)
    {
        if (amount <= 0)
            throw new ArgumentOutOfRangeException(nameof(amount), "Amount must be positive.");

        var account = Login(socialClubId, string.Empty);
        if (account.Character is null || account.Character.Cash < amount)
            return false;

        account.Character.Cash -= amount;
        account.Character.Bank += amount;
        Save();
        return true;
    }

    private void Load()
    {
        var path = Path.Combine(_dataDirectory, "accounts.json");
        if (!File.Exists(path))
            return;

        var accounts = JsonSerializer.Deserialize<List<Account>>(File.ReadAllText(path), JsonOptions);
        if (accounts is null)
            return;

        foreach (var account in accounts)
            _accounts[account.SocialClubId] = account;
    }

    private void Save()
    {
        var path = Path.Combine(_dataDirectory, "accounts.json");
        var json = JsonSerializer.Serialize(_accounts.Values.ToList(), JsonOptions);
        var temporary = path + ".tmp";
        File.WriteAllText(temporary, json);
        File.Move(temporary, path, overwrite: true);
    }
}
