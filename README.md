# GPT-APP

Aplicativo desktop com UI em Angular renderizada dentro de uma janela nativa via
webview (Photino.NET).

## Stack
- **.NET 10** — host desktop WinForms com **WebView2** (`Microsoft.Web.WebView2`)
- **Angular 21** — UI web (o PrimeNG mais recente suporta Angular 21)
- **PrimeNG** (tema Aura) + PrimeIcons

> Requer o **WebView2 Runtime** (já incluso no Windows 11 / Edge). Optou-se pelo
> WebView2 oficial da Microsoft por render nativamente confiável neste ambiente.

## Estrutura
```
GPT-APP/
├─ src/
│  ├─ Desktop/     # Host .NET (WinForms + WebView2) — abre a janela e carrega o Angular
│  └─ web/         # App Angular + PrimeNG
├─ GPT-APP.sln
└─ README.md
```

## Pré-requisitos
- .NET SDK 10+
- Node.js 24 LTS (ou 22.22.3+)

## Executar em desenvolvimento
Em DEBUG o host **sobe o `ng serve` automaticamente** (se ainda não estiver no ar),
aguarda ele responder em `http://localhost:4200` e então abre a janela. Ao fechar a
janela, o `ng serve` iniciado por ele é encerrado.

### Visual Studio
Basta definir **`Desktop`** como projeto de inicialização e apertar **F5** — ele
inicia o Angular e o host juntos. O projeto Angular também faz parte da solution
(`src/web/web.esproj`) e pode ser editado/executado (`npm start`) pelo Visual Studio.

### Linha de comando
Primeira vez, instale as dependências do Angular:
```bash
cd src/web && npm install
```
Depois, um único comando inicia tudo:
```bash
dotnet run --project src/Desktop
```

A janela nativa deve abrir exibindo a tela **Hello World** com um card e botão PrimeNG.

## Próximas etapas (fora do escopo desta base)
- Servir o build estático do Angular embutido no executável para produção.
- Ponte de comunicação JS ↔ .NET (Photino messaging).
- Empacotamento / instalador.


git tag v0.1.0 && git push --tags