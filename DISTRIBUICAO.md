# Distribuição e atualizações

O app é empacotado com **[Velopack](https://velopack.io)** e distribuído pelas
**GitHub Releases**. Cada amigo instala uma vez e recebe atualizações automaticamente.

## Pré-requisitos (uma vez)
1. Criar o repositório **público** no GitHub e fazer o primeiro push.
2. Em [src/Desktop/UpdateService.cs](src/Desktop/UpdateService.cs), trocar `<OWNER>`
   pelo seu usuário/organização em `RepoUrl`.
3. Pronto — o workflow usa o `GITHUB_TOKEN` automático (nada a configurar).

## Publicar uma nova versão
```bash
git tag v0.1.0
git push --tags
```
O GitHub Actions ([.github/workflows/release.yml](.github/workflows/release.yml)):
1. Builda o Angular e copia para `src/Desktop/wwwroot`.
2. `dotnet publish` self-contained (win-x64).
3. `vpk pack` + `vpk upload github` publicam o instalador e o feed na Release.

Os apps instalados verificam o feed ao abrir e **aplicam a atualização ao fechar**.

## Como os amigos instalam
- Baixar o **`GPT-APP-win-Setup.exe`** da página de Releases e executar.
- Na 1ª execução o Windows **SmartScreen** pode avisar (app sem assinatura):
  *Mais informações → Executar assim mesmo*.
- Ao abrir pela primeira vez, informar as **chaves da Azure OpenAI** no diálogo de
  configurações (engrenagem no topo). Ficam salvas só na máquina do usuário
  (`%APPDATA%/GPT-APP/settings.json`).

## Gerar o instalador localmente (teste)
```bash
# 1) Angular → wwwroot
cd src/web && npm run build && cd ../..
rm -rf src/Desktop/wwwroot && mkdir src/Desktop/wwwroot
cp -r src/web/dist/web/browser/* src/Desktop/wwwroot/

# 2) publish self-contained
dotnet publish src/Desktop/Desktop.csproj -c Release -r win-x64 --self-contained -o publish

# 3) empacotar
dotnet tool install -g vpk
vpk pack --packId GPT-APP --packVersion 0.1.0 --packDir publish --mainExe Desktop.exe --packTitle "GPT-APP" --icon src/Desktop/app.ico
# → gera Releases/GPT-APP-win-Setup.exe
```

## Requisitos na máquina do amigo
- Windows 10/11 x64. O **WebView2 Runtime** já vem no Windows 11 (e na maioria dos
  Windows 10 via Edge). Não é preciso instalar .NET (publicamos self-contained).
