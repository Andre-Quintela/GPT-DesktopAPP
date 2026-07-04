using Velopack;
using Velopack.Sources;

namespace Desktop;

/// <summary>
/// Verifica e baixa atualizações a partir das GitHub Releases. A atualização é
/// aplicada quando o usuário fecha o app (sem interromper o uso).
/// </summary>
public static class UpdateService
{
    // TODO: substituir <OWNER> pelo dono do repositório após criar no GitHub.
    private const string RepoUrl = "https://github.com/Andre-Quintela/GPT-DesktopAPP";

    public static async Task CheckAndApplyInBackgroundAsync()
    {
        try
        {
            var mgr = new UpdateManager(new GithubSource(RepoUrl, null, prerelease: false));

            // Só faz sentido quando instalado via Velopack (ignora execução avulsa).
            if (!mgr.IsInstalled)
            {
                return;
            }

            var updateInfo = await mgr.CheckForUpdatesAsync();
            if (updateInfo is null)
            {
                return;
            }

            await mgr.DownloadUpdatesAsync(updateInfo);

            // Aplica ao encerrar o app (na próxima vez já estará atualizado).
            mgr.WaitExitThenApplyUpdates(updateInfo);
        }
        catch
        {
            // Sem internet / sem release / repo ainda não publicado → ignora.
        }
    }
}
