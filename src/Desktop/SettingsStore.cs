using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Desktop;

/// <summary>
/// Guarda as configurações do Azure OpenAI informadas pelo usuário em
/// %APPDATA%/GPT-APP/settings.json. Se o arquivo não existir, faz fallback para a
/// configuração (appsettings.Development.json) — conveniente em desenvolvimento.
/// </summary>
public sealed class SettingsStore
{
    private static readonly JsonSerializerOptions Json =
        new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private readonly string _path;
    private readonly OpenAiOptions _fallback;
    private readonly object _gate = new();
    private OpenAiOptions? _cached;

    public SettingsStore(IConfiguration configuration)
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "GPT-APP");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "settings.json");

        _fallback = new OpenAiOptions();
        configuration.GetSection(OpenAiOptions.SectionName).Bind(_fallback);
    }

    /// <summary>Configuração efetiva (arquivo do usuário ou fallback do appsettings).</summary>
    public OpenAiOptions Current
    {
        get
        {
            lock (_gate)
            {
                if (_cached is not null)
                {
                    return _cached;
                }

                if (File.Exists(_path))
                {
                    try
                    {
                        var fromFile = JsonSerializer.Deserialize<OpenAiOptions>(
                            File.ReadAllText(_path), Json);
                        if (fromFile is not null)
                        {
                            _cached = fromFile;
                            return _cached;
                        }
                    }
                    catch
                    {
                        // arquivo corrompido → usa fallback
                    }
                }

                _cached = _fallback;
                return _cached;
            }
        }
    }

    /// <summary>Há chaves suficientes para operar (chat configurado).</summary>
    public bool IsConfigured
    {
        get
        {
            var c = Current.Chat;
            return !string.IsNullOrWhiteSpace(c.Endpoint)
                && !string.IsNullOrWhiteSpace(c.ApiKey)
                && !string.IsNullOrWhiteSpace(c.DeploymentName);
        }
    }

    public void Save(OpenAiOptions options)
    {
        lock (_gate)
        {
            File.WriteAllText(_path, JsonSerializer.Serialize(options, Json));
            _cached = options;
        }
    }
}
