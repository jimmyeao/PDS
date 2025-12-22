using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using OtpNet;
using TheiaCast.Api.Contracts;

namespace TheiaCast.Api;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterDto dto);
    Task<AuthResponse> LoginAsync(LoginDto dto);
    Task<AuthResponse> RefreshAsync(RefreshDto dto);
    Task ChangePasswordAsync(string username, string currentPassword, string newPassword);
    Task<MfaSetupResponse> SetupMfaAsync(string username);
    Task EnableMfaAsync(string username, string code);
    Task DisableMfaAsync(string username);
    Task<UserDto> MeAsync(ClaimsPrincipal user);
}

public class AuthService : IAuthService
{
    private readonly IConfiguration _config;
    private readonly PdsDbContext _db;
    private readonly ILogService _logService;

    public AuthService(IConfiguration config, PdsDbContext db, ILogService logService)
    {
        _config = config;
        _db = db;
        _logService = logService;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterDto dto)
    {
        // Check if user already exists
        var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Username == dto.Username);
        if (existingUser != null)
        {
            // Log failed registration attempt
            await _logService.AddLogAsync("Warning",
                $"Failed registration attempt: Username '{dto.Username}' already exists",
                null,
                "AuthService");
            throw new Exception("Username already exists");
        }

        // Hash the password
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(dto.Password);
        var hash = BitConverter.ToString(sha256.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();

        // Create new user
        var user = new User
        {
            Username = dto.Username,
            PasswordHash = hash,
            IsMfaEnabled = false
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // Log successful registration
        await _logService.AddLogAsync("Info",
            $"New user registered: '{user.Username}' (ID: {user.Id})",
            null,
            "AuthService");

        return GenerateTokens(user.Username);
    }

    public async Task<AuthResponse> LoginAsync(LoginDto dto)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == dto.Username);
        if (user == null)
        {
            // Log failed login attempt
            await _logService.AddLogAsync("Warning",
                $"Failed login attempt: User '{dto.Username}' not found",
                null,
                "AuthService");
            throw new Exception("Invalid credentials");
        }

        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(dto.Password);
        var hash = BitConverter.ToString(sha256.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();

        if (user.PasswordHash != hash)
        {
            // Log failed login attempt
            await _logService.AddLogAsync("Warning",
                $"Failed login attempt: Invalid password for user '{dto.Username}'",
                null,
                "AuthService");
            throw new Exception("Invalid credentials");
        }

        if (user.IsMfaEnabled)
        {
            if (string.IsNullOrEmpty(dto.MfaCode))
            {
                throw new Exception("MFA_REQUIRED");
            }

            var totp = new Totp(Base32Encoding.ToBytes(user.MfaSecret));
            if (!totp.VerifyTotp(dto.MfaCode, out _, VerificationWindow.RfcSpecifiedNetworkDelay))
            {
                // Log failed MFA attempt
                await _logService.AddLogAsync("Warning",
                    $"Failed MFA verification for user '{dto.Username}'",
                    null,
                    "AuthService");
                throw new Exception("Invalid MFA code");
            }
        }

        // Log successful login
        await _logService.AddLogAsync("Info",
            $"User logged in: '{user.Username}' (ID: {user.Id}){(user.IsMfaEnabled ? " with MFA" : "")}",
            null,
            "AuthService");

        return GenerateTokens(user.Username);
    }

    public Task<AuthResponse> RefreshAsync(RefreshDto dto)
        => Task.FromResult(GenerateTokens("user"));

    public async Task ChangePasswordAsync(string username, string currentPassword, string newPassword)
    {
        if (string.IsNullOrEmpty(newPassword) || newPassword.Length < 6)
            throw new Exception("New password must be at least 6 characters long");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null) throw new Exception("User not found");

        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var currentBytes = System.Text.Encoding.UTF8.GetBytes(currentPassword);
        var currentHash = BitConverter.ToString(sha256.ComputeHash(currentBytes)).Replace("-", "").ToLowerInvariant();

        if (user.PasswordHash != currentHash)
        {
            // Log failed password change attempt
            await _logService.AddLogAsync("Warning",
                $"Failed password change attempt: Incorrect current password for user '{username}'",
                null,
                "AuthService");
            throw new Exception("Current password is incorrect");
        }

        var newBytes = System.Text.Encoding.UTF8.GetBytes(newPassword);
        var newHash = BitConverter.ToString(sha256.ComputeHash(newBytes)).Replace("-", "").ToLowerInvariant();

        user.PasswordHash = newHash;
        await _db.SaveChangesAsync();

        // Log successful password change
        await _logService.AddLogAsync("Info",
            $"Password changed for user '{username}' (ID: {user.Id})",
            null,
            "AuthService");
    }

    public async Task<MfaSetupResponse> SetupMfaAsync(string username)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null) throw new Exception("User not found");

        var key = KeyGeneration.GenerateRandomKey(20);
        var secret = Base32Encoding.ToString(key);

        user.MfaSecret = secret;
        await _db.SaveChangesAsync();

        var qrCodeUri = $"otpauth://totp/PDS:{username}?secret={secret}&issuer=PDS";
        return new MfaSetupResponse(secret, qrCodeUri);
    }

    public async Task EnableMfaAsync(string username, string code)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null) throw new Exception("User not found");
        if (string.IsNullOrEmpty(user.MfaSecret)) throw new Exception("MFA setup not initiated");

        var totp = new Totp(Base32Encoding.ToBytes(user.MfaSecret));
        if (!totp.VerifyTotp(code, out _, VerificationWindow.RfcSpecifiedNetworkDelay))
        {
            // Log failed MFA enablement attempt
            await _logService.AddLogAsync("Warning",
                $"Failed MFA enablement attempt: Invalid code for user '{username}'",
                null,
                "AuthService");
            throw new Exception("Invalid MFA code");
        }

        user.IsMfaEnabled = true;
        await _db.SaveChangesAsync();

        // Log successful MFA enablement
        await _logService.AddLogAsync("Info",
            $"MFA enabled for user '{username}' (ID: {user.Id})",
            null,
            "AuthService");
    }

    public async Task DisableMfaAsync(string username)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null) throw new Exception("User not found");

        user.IsMfaEnabled = false;
        user.MfaSecret = null;
        await _db.SaveChangesAsync();

        // Log MFA disablement
        await _logService.AddLogAsync("Info",
            $"MFA disabled for user '{username}' (ID: {user.Id})",
            null,
            "AuthService");
    }

    public async Task<UserDto> MeAsync(ClaimsPrincipal principal)
    {
        var username = principal.Identity?.Name;
        if (username == null) return new UserDto(0, "guest", false);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null) return new UserDto(0, "guest", false);
        return new UserDto(user.Id, user.Username, user.IsMfaEnabled);
    }

    private AuthResponse GenerateTokens(string username)
    {
        var issuer = _config["Jwt:Issuer"] ?? "pds";
        var audience = _config["Jwt:Audience"] ?? "pds-clients";
        var secret = _config["Jwt:Secret"] ?? "dev-secret-key";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, username),
            new Claim(ClaimTypes.Name, username)
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = Guid.NewGuid().ToString("n");
        return new AuthResponse(accessToken, refreshToken);
    }
}

public static class AuthHelpers
{
    public static AuthResponse GenerateTokens(string username, IConfiguration config)
    {
        var issuer = config["Jwt:Issuer"] ?? "pds";
        var audience = config["Jwt:Audience"] ?? "pds-clients";
        var secret = config["Jwt:Secret"] ?? "dev-secret-key";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, username),
            new Claim(ClaimTypes.Name, username)
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = Guid.NewGuid().ToString("n");
        return new AuthResponse(accessToken, refreshToken);
    }
}
