using System.ClientModel;
using System.Text;
using System.Text.Json;
using Azure.AI.OpenAI;
using Desktop.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenAI.Chat;

namespace Desktop;

/// <summary>
/// API local (Kestrel in-process) que atua como proxy para o Azure OpenAI.
/// Mantém as chaves fora do cliente (WebView2/Angular).
/// </summary>
public static class ApiHost
{
    public const string BaseUrl = "http://localhost:5099";
    private const string CorsPolicy = "web";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static WebApplication Build()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ContentRootPath = AppContext.BaseDirectory
        });

        // Carrega config a partir do diretório do executável (appsettings*.json).
        builder.Configuration
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true)
#if DEBUG
            // Chaves de desenvolvimento (nunca vão para o build de distribuição).
            .AddJsonFile("appsettings.Development.json", optional: true)
#endif
            .AddUserSecrets(typeof(ApiHost).Assembly, optional: true)
            .AddEnvironmentVariables();

        builder.Services.Configure<OpenAiOptions>(
            builder.Configuration.GetSection(OpenAiOptions.SectionName));

        builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p => p
            .WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod()));

        builder.Services.AddHttpClient();

        // Configuração de chaves informada pelo usuário (%APPDATA%/GPT-APP/settings.json).
        builder.Services.AddSingleton<SettingsStore>();

        // Persistência (SQLite em %APPDATA%/GPT-APP/gpt-app.db).
        builder.Services.AddDbContext<ChatDbContext>(o => o.UseSqlite($"Data Source={GetDbPath()}"));

        builder.WebHost.UseUrls(BaseUrl);

        var app = builder.Build();
        app.UseCors(CorsPolicy);

        // Serve o build estático do Angular (produção): wwwroot + fallback SPA.
        app.UseDefaultFiles();
        app.UseStaticFiles();

        // Garante o schema criado.
        using (var scope = app.Services.CreateScope())
        {
            scope.ServiceProvider.GetRequiredService<ChatDbContext>().Database.EnsureCreated();
        }

        app.MapPost("/api/chat/stream", ChatStreamAsync);
        app.MapPost("/api/images/generate", GenerateImageAsync);
        app.MapConversationEndpoints();
        app.MapSettingsEndpoints();

        // SPA fallback (rotas do Angular que não são /api/*).
        app.MapFallbackToFile("index.html");

        return app;
    }

    private static string GetDbPath()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "GPT-APP");
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, "gpt-app.db");
    }

    // ---- Chat com streaming (SSE) ----
    private static async Task ChatStreamAsync(
        HttpContext http, ChatRequest request, SettingsStore settings)
    {
        if (!settings.IsConfigured)
        {
            http.Response.StatusCode = StatusCodes.Status409Conflict;
            await http.Response.WriteAsync("Configure suas chaves da Azure OpenAI.");
            return;
        }

        var cfg = settings.Current.Chat;
        var azure = new AzureOpenAIClient(new Uri(cfg.Endpoint), new ApiKeyCredential(cfg.ApiKey));
        var chatClient = azure.GetChatClient(cfg.DeploymentName);

        var messages = BuildMessages(request);

        http.Response.Headers.ContentType = "text/event-stream";
        http.Response.Headers.CacheControl = "no-cache";

        await foreach (var update in chatClient.CompleteChatStreamingAsync(messages, cancellationToken: http.RequestAborted))
        {
            foreach (var part in update.ContentUpdate)
            {
                if (string.IsNullOrEmpty(part.Text))
                {
                    continue;
                }

                var payload = JsonSerializer.Serialize(part.Text, Json);
                await http.Response.WriteAsync($"data: {payload}\n\n", http.RequestAborted);
                await http.Response.Body.FlushAsync(http.RequestAborted);
            }
        }

        await http.Response.WriteAsync("data: [DONE]\n\n", http.RequestAborted);
        await http.Response.Body.FlushAsync(http.RequestAborted);
    }

    private static List<ChatMessage> BuildMessages(ChatRequest request)
    {
        var messages = new List<ChatMessage>();

        foreach (var m in request.Messages ?? [])
        {
            var role = m.Role?.ToLowerInvariant();

            if (role == "system")
            {
                messages.Add(new SystemChatMessage(m.Text ?? ""));
                continue;
            }

            if (role == "assistant")
            {
                messages.Add(new AssistantChatMessage(m.Text ?? ""));
                continue;
            }

            // user (pode ter texto + imagens = input de visão)
            var parts = new List<ChatMessageContentPart>();
            if (!string.IsNullOrWhiteSpace(m.Text))
            {
                parts.Add(ChatMessageContentPart.CreateTextPart(m.Text));
            }

            if (m.Images is not null)
            {
                foreach (var img in m.Images)
                {
                    var bytes = Convert.FromBase64String(img.Base64);
                    parts.Add(ChatMessageContentPart.CreateImagePart(
                        BinaryData.FromBytes(bytes), img.MediaType));
                }
            }

            messages.Add(new UserChatMessage(parts));
        }

        return messages;
    }

    // ---- Geração de imagem (gpt-image-2 via REST) ----
    private static async Task<IResult> GenerateImageAsync(
        ImageRequest request,
        IHttpClientFactory httpFactory,
        SettingsStore settings)
    {
        var cfg = settings.Current.Images;
        if (string.IsNullOrWhiteSpace(cfg.Endpoint) || string.IsNullOrWhiteSpace(cfg.ApiKey))
        {
            return Results.Problem(detail: "Configure as chaves de imagem da Azure OpenAI.", statusCode: StatusCodes.Status409Conflict);
        }

        var endpoint = cfg.Endpoint.TrimEnd('/');
        var url = $"{endpoint}/openai/deployments/{cfg.DeploymentName}/images/generations?api-version={cfg.ApiVersion}";

        var body = new
        {
            prompt = request.Prompt,
            size = string.IsNullOrWhiteSpace(request.Size) ? "1024x1024" : request.Size,
            n = 1,
            output_format = "png"
        };

        using var client = httpFactory.CreateClient();
        using var content = new StringContent(JsonSerializer.Serialize(body, Json), Encoding.UTF8, "application/json");
        content.Headers.Remove("Content-Type");
        content.Headers.Add("Content-Type", "application/json");

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        httpRequest.Headers.Add("api-key", cfg.ApiKey);

        using var response = await client.SendAsync(httpRequest);
        var payload = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            return Results.Problem(detail: payload, statusCode: (int)response.StatusCode);
        }

        using var doc = JsonDocument.Parse(payload);
        var b64 = doc.RootElement.GetProperty("data")[0].GetProperty("b64_json").GetString();

        return Results.Json(new { b64 }, Json);
    }
}

// ---- Contratos (JSON vindo do Angular) ----
public sealed record ChatRequest(List<ChatMessageDto> Messages);
public sealed record ChatMessageDto(string Role, string? Text, List<ChatImageDto>? Images);
public sealed record ChatImageDto(string MediaType, string Base64);
public sealed record ImageRequest(string Prompt, string? Size);
