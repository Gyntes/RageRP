namespace RageRP.Core;

public sealed class Account
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string SocialClubId { get; set; } = string.Empty;
    public int Level { get; set; } = 1;
    public int Experience { get; set; }
    public Character? Character { get; set; }
}

public sealed class Character
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public int Age { get; set; } = 18;
    public decimal Cash { get; set; } = 5000;
    public decimal Bank { get; set; } = 10000;
    public string Faction { get; set; } = "Civilian";
    public string Job { get; set; } = "Unemployed";
    public Position Position { get; set; } = new(0, 0, 72);
}

public sealed record Position(float X, float Y, float Z);
