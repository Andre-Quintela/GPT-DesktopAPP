using Desktop.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Desktop;

/// <summary>Endpoints REST de persistência de conversas/mensagens (SQLite).</summary>
public static class ConversationEndpoints
{
    public static void MapConversationEndpoints(this IEndpointRouteBuilder app)
    {
        // Lista (apenas metadados), mais recentes primeiro.
        app.MapGet("/api/conversations", async (ChatDbContext db) =>
        {
            var items = await db.Conversations
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new ConversationSummaryDto(c.Id, c.Title, c.CreatedAt))
                .ToListAsync();
            return Results.Ok(items);
        });

        // Conversa completa (mensagens + imagens).
        app.MapGet("/api/conversations/{id}", async (string id, ChatDbContext db) =>
        {
            var conversation = await db.Conversations
                .Include(c => c.Messages)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (conversation is null)
            {
                return Results.NotFound();
            }

            return Results.Ok(ToDto(conversation));
        });

        // Cria conversa.
        app.MapPost("/api/conversations", async (CreateConversationRequest body, ChatDbContext db) =>
        {
            var entity = new ConversationEntity
            {
                Id = string.IsNullOrWhiteSpace(body.Id) ? Guid.NewGuid().ToString() : body.Id,
                Title = string.IsNullOrWhiteSpace(body.Title) ? "Nova conversa" : body.Title,
                CreatedAt = body.CreatedAt ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };
            db.Conversations.Add(entity);
            await db.SaveChangesAsync();
            return Results.Ok(new ConversationSummaryDto(entity.Id, entity.Title, entity.CreatedAt));
        });

        // Atualiza título.
        app.MapPut("/api/conversations/{id}/title", async (string id, UpdateTitleRequest body, ChatDbContext db) =>
        {
            var entity = await db.Conversations.FirstOrDefaultAsync(c => c.Id == id);
            if (entity is null)
            {
                return Results.NotFound();
            }
            entity.Title = body.Title;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Grava uma mensagem completa.
        app.MapPost("/api/conversations/{id}/messages", async (string id, AddMessageRequest body, ChatDbContext db) =>
        {
            var exists = await db.Conversations.AnyAsync(c => c.Id == id);
            if (!exists)
            {
                return Results.NotFound();
            }

            var message = new MessageEntity
            {
                Id = string.IsNullOrWhiteSpace(body.Id) ? Guid.NewGuid().ToString() : body.Id,
                ConversationId = id,
                Role = body.Role,
                Text = body.Text ?? "",
                CreatedAt = body.CreatedAt,
                Images = (body.Images ?? []).Select(i => new ImageEntity
                {
                    Id = i.Id,
                    MediaType = i.MediaType,
                    Base64 = i.Base64
                }).ToList()
            };

            db.Add(message);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Apaga conversa.
        app.MapDelete("/api/conversations/{id}", async (string id, ChatDbContext db) =>
        {
            var deleted = await db.Conversations.Where(c => c.Id == id).ExecuteDeleteAsync();
            return deleted > 0 ? Results.NoContent() : Results.NotFound();
        });
    }

    private static ConversationDto ToDto(ConversationEntity c) => new(
        c.Id,
        c.Title,
        c.CreatedAt,
        c.Messages
            .OrderBy(m => m.CreatedAt)
            .Select(m => new MessageDto(
                m.Id,
                m.Role,
                m.Text,
                m.CreatedAt,
                m.Images.Select(i => new ImageDto(i.Id, i.MediaType, i.Base64)).ToList()))
            .ToList());
}

// ---- Contratos ----
public sealed record ConversationSummaryDto(string Id, string Title, long CreatedAt);
public sealed record ConversationDto(string Id, string Title, long CreatedAt, List<MessageDto> Messages);
public sealed record MessageDto(string Id, string Role, string Text, long CreatedAt, List<ImageDto> Images);
public sealed record ImageDto(string Id, string MediaType, string Base64);
public sealed record CreateConversationRequest(string? Id, string? Title, long? CreatedAt);
public sealed record UpdateTitleRequest(string Title);
public sealed record AddMessageRequest(string Id, string Role, string? Text, long CreatedAt, List<ImageDto>? Images);
