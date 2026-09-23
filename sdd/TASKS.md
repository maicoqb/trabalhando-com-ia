# TASKS — Plano de implementação

Tarefas pequenas e ordenadas derivadas de [SPEC.md](./SPEC.md). Cada tarefa tem critério de
conclusão e gera um commit. Marcação: `[ ]` pendente, `[x]` concluída.

## T1 — Bootstrap do projeto TypeScript
- [x] `package.json` (ESM, Node 22) com scripts `build`, `start:server`, `start:worker`, `start`.
- [x] Dependências: `@modelcontextprotocol/sdk`, `express`, `better-sqlite3`, `zod`.
      Dev: `typescript`, `@types/node`, `@types/express`, `@types/better-sqlite3`.
- [x] `tsconfig.json` (target ES2022, module NodeNext, outDir `dist`, strict).
- [ ] Estrutura `src/`.
- **Concluído quando:** estrutura criada e `package.json`/`tsconfig.json` válidos.

## T2 — Camada de banco (SQLite)
- [ ] `src/config.ts` — caminho do DB (`DB_PATH`), porta (`PORT=9000`), path (`/mcp-memory`).
- [ ] `src/db.ts` — abre SQLite, cria tabela `memories` + índice em `status`.
- [ ] Funções: `insertMemory(content) -> id`, `claimNextPending() -> memory|null`
      (transição atômica `pending→processing`), `finishMemory(id, status, curatorOutput)`.
- **Concluído quando:** módulo compila e expõe as funções da fila conforme SPEC §6.

## T3 — Servidor MCP com `record_memory`
- [ ] `src/server.ts` — `McpServer` do SDK + `StreamableHTTPServerTransport`.
- [ ] Registrar tool `record_memory` (input `{ content }` via zod, descrição durável/efêmero).
- [ ] Handler: valida, `insertMemory`, retorna imediatamente `Memória registrada (#id).`
- [ ] Express expõe `POST/GET/DELETE /mcp-memory` em `0.0.0.0:9000`.
- **Concluído quando:** servidor sobe e a tool aparece via handshake MCP (SPEC RF1–RF4).

## T4 — Worker de processamento
- [ ] `src/curatorPrompt.ts` — monta o prompt do curador (SPEC §8) a partir do `content`.
- [ ] `src/worker.ts` — loop de polling: `claimNextPending`, executa `llm "<prompt>"`
      (via `child_process`), captura saída, `finishMemory` com `done`/`error`.
- [ ] Robustez: erro em uma memória não derruba o loop; intervalo de polling configurável.
- **Concluído quando:** worker compila e processa uma memória invocando `llm` (SPEC RF5–RF10).

## T5 — Empacotamento Docker
- [x] `Dockerfile` — base `node-llm:latest`, copia projeto, `npm ci`, `npm run build`,
      comando que sobe servidor + worker (script `start`).
- [x] `docker-compose.yml` — serviço `mcp-memory`, `network_mode: host`, volume do SQLite,
      montagem read-only de `~/.kiro` e `~/.local/share/kiro-cli` (e `~/.aws` se existir)
      para o `llm` autenticar.
- [x] `.dockerignore`.
- **Concluído quando:** `docker compose up` sobe o serviço (SPEC §9, RNF1–RNF2).

## T6 — Verificação end-to-end
- [x] `npm run build` sem erros de TypeScript.
- [x] Subir o compose; verificar log de inicialização (servidor em :9000, worker ativo).
- [x] Handshake MCP + chamada `record_memory` (via cliente HTTP/JSON-RPC).
- [x] Confirmar persistência da memória e transição de status pelo worker.
- **Concluído quando:** fluxo coleta→persistência→processamento observado nos logs/DB.
