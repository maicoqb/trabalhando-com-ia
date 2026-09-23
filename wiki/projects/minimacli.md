---
title: minimacli
tags: [project, minimacli, dsh, cli, tui, vscode, nx, typescript, ink, react, thin-client, plugins]
---

# minimacli

Família de **clientes finos (thin clients) do harness DSH**: uma CLI de terminal (TUI) e uma extensão do VS Code. Os clientes conversam com um harness já em execução pela API HTTP/WebSocket e nunca sobem o próprio perfil de harness.

## O que é

Complementa a GUI web do DSH com duas superfícies adicionais — CLI de terminal e extensão do VS Code — mantendo o cliente "fino": ele só renderiza, envia prompts e responde aprovações. Quem executa ferramentas (`read`/`write`/`pwsh` etc.) e aplica o sandbox é sempre o harness.

## Objetivos que guiam o design

- **Segurança** — só o harness aplica o sandbox e a política de aprovação; nenhum cliente detém esse poder.
- **Isolamento** — cliente e harness são mundos separados; o cliente alcança o harness apenas pela API pública.
- **Desacoplamento** — o ciclo de vida do cliente independe de plugins, perfis ou configuração do harness.
- **Continuidade** — a mesma conversa fica disponível de qualquer superfície, de onde parou.
- **Concorrência** — várias sessões simultâneas sem conflito, mesmo no mesmo workspace.

## Arquitetura

Cliente fino + integração do harness movida para **plugins instaláveis**:

- **Clientes** — CLI de terminal e extensão VS Code; selecionam um plugin de harness e falam com o runtime dele pela API pública.
- **`@minimacli/dsh-plugin`** — adapta a API da web do DSH ao contrato de harness do minimacli; não implementa runtime, só conecta a uma web DSH existente.
- **`@minimacli/minimacli-harness-plugin`** — fornece o runtime independente `@minimacli/minimacli-harness`, um harness minimalista pensado para usar pouco contexto rodando LLMs locais em máquinas com pouca RAM.
- **Registro de plugins** — plugins instalados e opções padrão ficam em `~/.minimacli/plugins.json`.

## Particularidades

- **Monorepo Nx + TypeScript + React (Ink)** para a TUI.
- Comunicação por um conjunto estreito de RPCs (`host.describe`, `session.create`, `session.prompt`, `session.cancel`) mais um stream de eventos.
- **Modelo de turno ativo:** o turno começa ao enviar um prompt e só termina quando chega `assistant-complete` no stream. `session.prompt` (modo `queue`) resolve na hora e não significa fim do turno. A entrada pode bloquear o **envio** durante um turno, mas nunca o **digitar**.
- O cliente assume um harness DSH rodando em `http://127.0.0.1:3080`.

## Comandos

```sh
npx nx build minimacli                                  # build (dist/minimacli)
npx tsc -p apps/minimacli/tsconfig.app.json --noEmit    # type-check
npx nx lint minimacli                                   # lint
```

Instalar a CLI globalmente: `npx nx build minimacli && npm i -g ./dist/minimacli`.

## Status

Em desenvolvimento. O fluxo de instalação de plugins e a integração do plugin DSH estão implementados; o restante é polimento da TUI e estabilidade.
