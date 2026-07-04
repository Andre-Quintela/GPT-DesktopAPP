using Microsoft.Web.WebView2.WinForms;

namespace Desktop;

/// <summary>
/// Janela principal do app: hospeda a UI Angular via WebView2.
/// </summary>
public sealed class MainForm : Form
{
    private readonly WebView2 _webView;

    public MainForm(string url)
    {
        Text = "GPT-APP";
        Width = 1280;
        Height = 800;
        StartPosition = FormStartPosition.CenterScreen;

        _webView = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(_webView);

        // O Load roda na thread de UI (STA) com o SynchronizationContext do WinForms,
        // então os awaits abaixo continuam na mesma thread — requisito do WebView2.
        Load += async (_, _) =>
        {
            await _webView.EnsureCoreWebView2Async();
#if DEBUG
            await WaitForServerAsync(url);
#endif
            _webView.CoreWebView2.Navigate(url);
        };
    }

#if DEBUG
    private static async Task WaitForServerAsync(string url)
    {
        // Aguarda o ng serve compilar e começar a responder (timeout ~120s).
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
        for (var i = 0; i < 240; i++)
        {
            try
            {
                using var response = await client.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch
            {
                // servidor ainda não respondeu; tenta de novo
            }

            await Task.Delay(500);
        }
    }
#endif

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _webView.Dispose();
        }

        base.Dispose(disposing);
    }
}
