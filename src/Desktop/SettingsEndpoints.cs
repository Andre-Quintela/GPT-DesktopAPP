using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Desktop;

/// <summary>Endpoints de configuração das chaves Azure OpenAI (por usuário).</summary>
public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/settings", (SettingsStore store) =>
        {
            var o = store.Current;
            return Results.Ok(new SettingsDto(
                store.IsConfigured,
                new ResourceDto(o.Chat.Endpoint, o.Chat.DeploymentName, o.Chat.ApiKey),
                new ImageResourceDto(o.Images.Endpoint, o.Images.DeploymentName, o.Images.ApiVersion, o.Images.ApiKey)));
        });

        app.MapPut("/api/settings", (SettingsPayload body, SettingsStore store) =>
        {
            store.Save(new OpenAiOptions
            {
                Chat = new OpenAiOptions.ChatResource
                {
                    Endpoint = body.Chat.Endpoint?.Trim() ?? "",
                    DeploymentName = body.Chat.DeploymentName?.Trim() ?? "",
                    ApiKey = body.Chat.ApiKey?.Trim() ?? ""
                },
                Images = new OpenAiOptions.ImageResource
                {
                    Endpoint = body.Images.Endpoint?.Trim() ?? "",
                    DeploymentName = body.Images.DeploymentName?.Trim() ?? "",
                    ApiVersion = string.IsNullOrWhiteSpace(body.Images.ApiVersion) ? "2024-02-01" : body.Images.ApiVersion.Trim(),
                    ApiKey = body.Images.ApiKey?.Trim() ?? ""
                }
            });
            return Results.NoContent();
        });
    }
}

public sealed record SettingsDto(bool Configured, ResourceDto Chat, ImageResourceDto Images);
public sealed record ResourceDto(string Endpoint, string DeploymentName, string ApiKey);
public sealed record ImageResourceDto(string Endpoint, string DeploymentName, string ApiVersion, string ApiKey);
public sealed record SettingsPayload(ResourceInput Chat, ImageResourceInput Images);
public sealed record ResourceInput(string? Endpoint, string? DeploymentName, string? ApiKey);
public sealed record ImageResourceInput(string? Endpoint, string? DeploymentName, string? ApiVersion, string? ApiKey);
