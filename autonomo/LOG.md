# LOG — MCP de memórias (Wiki do Maico)

Registro cronológico da construção do projeto, conforme o AGENT.md.

## Passo 0 — Investigação do ambiente

- Repositório git na branch `autonomo`, árvore limpa.
- `node-llm:latest` disponível localmente. Inspeção da imagem (entrypoint sobrescrito):
  - Node 22.23.2, npm 10.9.8.
  - `llm` em `/usr/local/bin/llm`; conteúdo: `exec kiro-cli chat --no-interactive --trust-all-tools "$@"`.
  - WorkingDir `/workspace`, usuário root, entrypoint `llm`.
- Conclusão: o `llm` recebe o prompt como argumento posicional e imprime a resposta do LLM-curador (já configurado com os MCPs de leitura/escrita da wiki). Vou sobrescrever o entrypoint nos meus serviços.

## Passo 1 — Scaffold do projeto

- `package.json` (type: module, Node >=22), scripts de build/start/typecheck/test.
- `tsconfig.json` (NodeNext, strict).
- `.gitignore`, `.dockerignore`.
- `src/config.ts`: configuração central via env com defaults (porta 9000, path `/mcp-memory`, db em `./data/memorias.sqlite`, comando `llm`, polling/timeout/retries do worker).
- Dependências: `@modelcontextprotocol/sdk`, `better-sqlite3`, `express`, `zod`.
- Decisão: alinhado `zod` à versão resolvida pelo SDK (3.25.76) para evitar conflito de instâncias (erro TS `~standard`).

## Passo 2 — Camada de banco (SQLite)

- `src/db.ts`: `MemoryStore` sobre better-sqlite3 (WAL, busy_timeout).
- Tabela única `memories` funciona como armazenamento cru **e** fila, via campo `status` (`pending` → `processing` → `done`/`failed`).
- `enqueue()` grava a memória crua e enfileira atomicamente.
- `claimNext()` usa transação IMMEDIATE para reivindicar a próxima pendente sem corrida entre workers.
- `markDone` / `markFailure` (com retry até `maxAttempts`), `recoverStuckProcessing` no startup.

## Passo 3 — Servidor MCP + tool record_memory

- `src/server.ts`: Express + `StreamableHTTPServerTransport` em modo stateless, servindo em `<host>:<port><mcpPath>` (default `0.0.0.0:9000/mcp-memory`).
- Tool `record_memory({ content })` com descrição que orienta durável vs. efêmero (as 8 categorias do escopo). Grava crua + enfileira e **retorna imediatamente** (não bloqueia o cliente).
- Endpoint `/health` para healthcheck.

## Passo 4 — Curador + Worker

- `src/curator.ts`: `buildCuratorPrompt` enquadra a decisão na "Wiki do Maico" (relevância relativa ao domínio e ao conhecimento existente). `runCurator` invoca `llm` via `spawn` com array de args (sem shell → sem injeção), com timeout.
- `src/worker.ts`: loop de polling assíncrono, sequencial; reivindica, invoca curador, marca done/retry/falha.

## Passo 5 — Testes e verificação local

- `src/test/db.test.ts`, `src/test/curator.test.ts`, `src/test/worker.test.ts`: 13 testes com `node:test`, todos passando.
  - Armadilha corrigida: o script `llm` falso do teste grepava o prompt inteiro por "projeto", mas o próprio enquadramento contém "projetos" → falso positivo. Ajustado para inspecionar só a última linha (a memória).
  - Armadilha corrigida: `sleep <prompt>` falha por argumento inválido antes do timeout; troquei por um script `.sh` que dorme de fato.
- Smoke test HTTP real do servidor: `initialize`, `tools/list` (mostra `record_memory` com `content` e descrição durável/efêmero) e `tools/call` (retorna na hora; `/health` confirma `pending: 1`). Tudo OK.

## Passo 6 — Docker e verificação ponta a ponta

- `Dockerfile`: `FROM node-llm:latest`, `ENTRYPOINT []` (a base define `ENTRYPOINT ["llm"]`), `npm ci` + `npm run build`. `better-sqlite3` (nativo) compila com a toolchain da base.
- `docker-compose.yml`: dois serviços (`server`, `worker`) compartilhando imagem e volume SQLite. Ambos com `network_mode: host` (o `llm`/MCPs da wiki respondem no localhost do host). `command` seleciona server vs. worker.
- Decisão: tabela única servindo de fila + store compartilhada via volume nomeado montado nos dois containers (SQLite WAL suporta multi-processo no mesmo FS).
- `docker compose build` OK. `docker compose up -d` sobe os dois serviços; `/health` responde em `http://localhost:9000` (prova o host networking).
- E2E no Docker: `record_memory` gravou id=1 (retorno imediato). `docker top` do worker mostrou a cadeia real:
  `node worker.js` → `kiro-cli chat ... "<prompt do curador com a memória>"` (o comando `llm`) → `kiro-cli-chat acp` (curador conectando aos MCPs da wiki).
  O worker registrou "memória id=1 concluída pelo curador" e o banco passou a `status=done`. Pipeline completo funcionando.
- `docker compose down -v` para limpar.
