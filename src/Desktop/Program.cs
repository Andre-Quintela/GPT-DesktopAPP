using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;

namespace Desktop;

internal static class Program
{
    // Em desenvolvimento a UI é servida pelo dev server do Angular (ng serve).
    // Em produção (etapa futura) será servida a partir do build estático.
    private const string AppUrl = "http://localhost:4200";

    // Main precisa ser síncrono e STA: o WebView2 exige que o message loop
    // (Application.Run) rode na thread STA. Um `async Task Main` faria a
    // continuação após o await cair numa thread do pool (MTA) → RPC_E_CHANGED_MODE.
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();

        Process? angularProcess = null;

        // Sobe a API local (proxy do Azure OpenAI) em background.
        var api = ApiHost.Build();
        api.StartAsync().GetAwaiter().GetResult();

#if DEBUG
        // Em DEBUG o próprio host sobe o `ng serve` (se ainda não estiver no ar).
        // A espera até o servidor responder acontece no Load do formulário.
        if (!IsServerUp(AppUrl))
        {
            angularProcess = StartAngularDevServer();
        }
#endif

        using var form = new MainForm(AppUrl);

        // Ao fechar a janela, derruba o ng serve e para a API.
        form.FormClosed += (_, _) =>
        {
            StopProcessTree(angularProcess);
            api.StopAsync().GetAwaiter().GetResult();
        };

        Application.Run(form);
    }

    private static bool IsServerUp(string url)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
            using var response = client.GetAsync(url).GetAwaiter().GetResult();
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static Process StartAngularDevServer()
    {
        // AppContext.BaseDirectory = src/Desktop/bin/<cfg>/<tfm>/ → sobe até src/ e entra em web/.
        var webDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "web"));

        var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
        var psi = new ProcessStartInfo
        {
            FileName = isWindows ? "cmd.exe" : "npm",
            Arguments = isWindows ? "/c npm start" : "start",
            WorkingDirectory = webDir,
            UseShellExecute = false
        };

        return Process.Start(psi)
            ?? throw new InvalidOperationException("Não foi possível iniciar o ng serve.");
    }

    private static void StopProcessTree(Process? process)
    {
        if (process is null || process.HasExited)
        {
            return;
        }

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            // Encerra a árvore inteira (cmd.exe → node/ng serve).
            using var kill = Process.Start(new ProcessStartInfo
            {
                FileName = "taskkill",
                Arguments = $"/PID {process.Id} /T /F",
                UseShellExecute = false,
                CreateNoWindow = true
            });
            kill?.WaitForExit();
        }
        else
        {
            process.Kill(entireProcessTree: true);
        }
    }
}
