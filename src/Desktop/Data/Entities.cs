namespace Desktop.Data;

/// <summary>Conversa persistida com suas mensagens.</summary>
public sealed class ConversationEntity
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public long CreatedAt { get; set; }

    public List<MessageEntity> Messages { get; set; } = [];
}

/// <summary>Mensagem de uma conversa (texto + imagens embutidas em JSON).</summary>
public sealed class MessageEntity
{
    public string Id { get; set; } = "";
    public string ConversationId { get; set; } = "";
    public string Role { get; set; } = "";
    public string Text { get; set; } = "";
    public long CreatedAt { get; set; }

    // Reply: referência a uma mensagem anterior citada por esta.
    public string? ReplyToId { get; set; }
    public string? ReplyToRole { get; set; }
    public string? ReplyExcerpt { get; set; }

    public List<ImageEntity> Images { get; set; } = [];
}

/// <summary>Imagem anexada/gerada (armazenada como JSON dentro da mensagem).</summary>
public sealed class ImageEntity
{
    public string Id { get; set; } = "";
    public string MediaType { get; set; } = "";
    public string Base64 { get; set; } = "";
}
