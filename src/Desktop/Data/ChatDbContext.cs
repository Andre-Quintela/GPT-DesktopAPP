using Microsoft.EntityFrameworkCore;

namespace Desktop.Data;

/// <summary>Contexto EF Core (SQLite) para conversas e mensagens.</summary>
public sealed class ChatDbContext(DbContextOptions<ChatDbContext> options) : DbContext(options)
{
    public DbSet<ConversationEntity> Conversations => Set<ConversationEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var conversation = modelBuilder.Entity<ConversationEntity>();
        conversation.HasKey(c => c.Id);
        conversation.Property(c => c.Title).IsRequired();

        conversation
            .HasMany(c => c.Messages)
            .WithOne()
            .HasForeignKey(m => m.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        var message = modelBuilder.Entity<MessageEntity>();
        message.HasKey(m => m.Id);
        // Imagens embutidas como coleção owned em JSON (uma coluna).
        message.OwnsMany(m => m.Images, img => img.ToJson());
    }
}
