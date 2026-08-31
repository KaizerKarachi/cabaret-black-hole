using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.SignalR;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls(builder.Configuration["Urls"] ?? "http://127.0.0.1:5088");

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var tokenSecret = builder.Configuration["Chat:TokenSecret"] ?? "cabaret-dev-secret";
var tokenHours = int.TryParse(builder.Configuration["Chat:TokenHours"], out var hours) ? hours : 72;

builder.Services.AddSingleton(new TokenService(tokenSecret, tokenHours));
builder.Services.AddSingleton<UserStore>();
builder.Services.AddSingleton<ChatHistory>();
builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.SetIsOriginAllowed(_ => true)
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();
app.UseForwardedHeaders();
app.UseCors();

app.Use(async (context, next) =>
{
    var tokens = context.RequestServices.GetRequiredService<TokenService>();
    var raw = context.Request.Headers.Authorization.ToString();
    if (raw.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        raw = raw["Bearer ".Length..].Trim();
    else
        raw = context.Request.Query["access_token"].ToString();

    if (!string.IsNullOrEmpty(raw) && tokens.TryRead(raw, out var session))
        context.Items["chat"] = session;

    await next();
});

app.MapPost("/api/login", (LoginRequest body, UserStore users, TokenService tokens) =>
{
    var user = users.Find(body.Username, body.Password);
    if (user is null)
        return Results.Json(new { error = "Неверный логин или пароль" }, statusCode: 401);

    var token = tokens.Issue(user);
    return Results.Ok(new { token, username = user.Username, name = user.Name });
});

app.MapGet("/api/me", (HttpContext ctx) =>
{
    if (ctx.Items["chat"] is not ChatSession session)
        return Results.Unauthorized();
    return Results.Ok(new { username = session.Username, name = session.Name });
});

app.MapHub<ChatHub>("/hubs/chat");

var usersPath = Path.Combine(app.Environment.ContentRootPath, "users.json");
if (!File.Exists(usersPath))
{
    var example = Path.Combine(app.Environment.ContentRootPath, "users.example.json");
    if (File.Exists(example))
        File.Copy(example, usersPath);
}

app.Run();

record LoginRequest(string Username, string Password);

record ChatUser(string Username, string Password, string Name);

record ChatSession(string Username, string Name);

record ChatMessageDto(string Username, string Name, string Text, DateTimeOffset At);

sealed class UserStore
{
    private readonly string _path;
    private readonly object _gate = new();

    public UserStore(IWebHostEnvironment env)
    {
        _path = Path.Combine(env.ContentRootPath, "users.json");
    }

    public ChatUser? Find(string? username, string? password)
    {
        if (string.IsNullOrWhiteSpace(username) || password is null)
            return null;

        lock (_gate)
        {
            if (!File.Exists(_path))
                return null;

            using var stream = File.OpenRead(_path);
            var file = JsonSerializer.Deserialize<UsersFile>(stream, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return file?.Users?.FirstOrDefault(u =>
                string.Equals(u.Username, username.Trim(), StringComparison.OrdinalIgnoreCase)
                && u.Password == password);
        }
    }

    private sealed class UsersFile
    {
        public List<ChatUser> Users { get; set; } = new();
    }
}

sealed class TokenService
{
    private readonly byte[] _key;
    private readonly TimeSpan _lifetime;

    public TokenService(string secret, int hours)
    {
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
        _lifetime = TimeSpan.FromHours(Math.Clamp(hours, 1, 720));
    }

    public string Issue(ChatUser user)
    {
        var exp = DateTimeOffset.UtcNow.Add(_lifetime).ToUnixTimeSeconds();
        var payload = $"{user.Username}\n{user.Name}\n{exp}";
        var sig = Convert.ToHexString(HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes(payload)));
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(payload + "\n" + sig));
    }

    public bool TryRead(string token, out ChatSession session)
    {
        session = new ChatSession("", "");
        try
        {
            var text = Encoding.UTF8.GetString(Convert.FromBase64String(token));
            var parts = text.Split('\n');
            if (parts.Length != 4)
                return false;

            var payload = $"{parts[0]}\n{parts[1]}\n{parts[2]}";
            var expected = Convert.ToHexString(HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes(payload)));
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(expected),
                    Encoding.UTF8.GetBytes(parts[3])))
                return false;

            if (!long.TryParse(parts[2], out var exp) || DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp)
                return false;

            session = new ChatSession(parts[0], parts[1]);
            return true;
        }
        catch
        {
            return false;
        }
    }
}

sealed class ChatHistory
{
    private readonly ConcurrentQueue<ChatMessageDto> _messages = new();
    private const int Max = 80;

    public IReadOnlyList<ChatMessageDto> Snapshot() => _messages.ToArray();

    public ChatMessageDto Add(ChatSession session, string text)
    {
        var message = new ChatMessageDto(session.Username, session.Name, text, DateTimeOffset.UtcNow);
        _messages.Enqueue(message);
        while (_messages.Count > Max && _messages.TryDequeue(out _)) { }
        return message;
    }
}

sealed class ChatHub : Hub
{
    private readonly ChatHistory _history;

    public ChatHub(ChatHistory history)
    {
        _history = history;
    }

    public override async Task OnConnectedAsync()
    {
        var session = GetSession();
        if (session is null)
            throw new HubException("Нужно войти");

        await Clients.Caller.SendAsync("history", _history.Snapshot());
        await base.OnConnectedAsync();
    }

    public async Task SendMessage(string text)
    {
        var session = GetSession() ?? throw new HubException("Нужно войти");
        text = (text ?? string.Empty).Trim();
        if (text.Length == 0)
            return;
        if (text.Length > 500)
            text = text[..500];

        var message = _history.Add(session, text);
        await Clients.All.SendAsync("message", message);
    }

    private ChatSession? GetSession() =>
        Context.GetHttpContext()?.Items["chat"] as ChatSession;
}
