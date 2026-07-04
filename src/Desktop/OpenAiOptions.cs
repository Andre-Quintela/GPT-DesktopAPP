namespace Desktop;

/// <summary>
/// Configuração dos recursos Azure OpenAI (vinculada da seção "OpenAI").
/// Os valores reais ficam em appsettings.Development.json / User Secrets (fora do git).
/// </summary>
public sealed class OpenAiOptions
{
    public const string SectionName = "OpenAI";

    public ChatResource Chat { get; set; } = new();
    public ImageResource Images { get; set; } = new();

    public sealed class ChatResource
    {
        public string Endpoint { get; set; } = "";
        public string DeploymentName { get; set; } = "";
        public string ApiKey { get; set; } = "";
    }

    public sealed class ImageResource
    {
        public string Endpoint { get; set; } = "";
        public string DeploymentName { get; set; } = "";
        public string ApiVersion { get; set; } = "2024-02-01";
        public string ApiKey { get; set; } = "";
    }
}
