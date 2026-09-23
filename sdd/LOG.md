# LOG

Registro dos passos do desenvolvimento orientado a especificação (Spec-Driven Development)
do MCP de Memórias (Wiki do Maico).

## Passo 1 — Especificação (SPEC.md)

- Li `AGENT.md` e `ESCOPO.md`.
- Inspecionei a imagem `node-llm:latest`: Node 22, workdir `/workspace`, entrypoint `llm`
  (`kiro-cli chat --no-interactive --trust-all-tools "$@"`), MCP da wiki configurado em
  `~/.kiro/settings/mcp.json` apontando para `http://localhost:9001/mcp` (`maicoWiki`).
- Confirmei que credenciais do `kiro-cli` vivem em `~/.local/share/kiro-cli` e `~/.kiro` no host.
- Escrevi `SPEC.md`: requisitos funcionais/não-funcionais, arquitetura, modelo de dados SQLite,
  contrato da tool `record_memory`, prompt do curador, empacotamento com `network_mode: host`,
  e mapeamento com os critérios de aceitação do escopo.
- Decisões de design: SQLite (sem serviço extra); um único container rodando servidor MCP + worker
  compartilhando o arquivo SQLite; Streamable HTTP transport em `:9000/mcp-memory`.

## Passo 2 — Tarefas (TASKS.md)

- Quebrei a especificação em 6 tarefas ordenadas (T1..T6): bootstrap TS, camada de banco,
  servidor MCP, worker, empacotamento Docker, verificação end-to-end.
- Cada tarefa tem critério de conclusão explícito e gera um commit.

## Passo 3 — Bootstrap TypeScript (T1)

- `package.json` (ESM, Node ≥22), `tsconfig.json` (NodeNext, strict), estrutura `src/`.
- Deps: `@modelcontextprotocol/sdk`, `better-sqlite3`, `zod`. Dev: `typescript`, `@types/*`.
- `npm run build` compila sem erros → `dist/`.

## Passo 4 — Camada de banco (T2)

- `src/config.ts`: PORT=9000, MCP_PATH=/mcp-memory, DB_PATH=/data/memories.db, llmCommand=llm.
- `src/db.ts`: SQLite (WAL), tabela `memories(id,content,status,curator_output,created_at,updated_at)`
  + índice em (status,created_at). Funções `insertMemory`, `claimNextPending` (transição atômica
  pending→processing), `finishMemory`, `getMemory`.

## Passo 5 — Servidor MCP com record_memory (T3)

- `src/server.ts`: `McpServer` + `StreamableHTTPServerTransport` (stateless), tool `record_memory`
  com descrição durável/efêmero e input `{content}` (zod). Grava crua + retorna `Memória registrada (#id)`.
- **Armadilha resolvida:** o `express` não fazia bind da porta neste ambiente (WSL/`/mnt/c`); o
  callback de `listen` nunca disparava. Um servidor `node:http` puro faz bind normalmente. Decisão:
  remover `express` e usar o servidor HTTP nativo do Node, adaptando `transport.handleRequest`
  para `(IncomingMessage, ServerResponse, body)`. Removida a dependência `express`/`@types/express`.
- **Nota de ambiente:** o shell local em `/mnt/c` (filesystem Windows via WSL) trava processos em
  I/O de disco (estado `Dl`), então a verificação end-to-end real é feita dentro do Docker (Passo 8),
  onde o filesystem é Linux nativo. Build (`tsc`) e carregamento dos módulos foram validados.

## Passo 6 — Worker de processamento (T4)

- `src/curatorPrompt.ts`: prompt do curador da "Wiki do Maico" (consulta a wiki, escreve se agrega,
  ignora se fora do domínio; responde ESCRITO:/IGNORADO:).
- `src/worker.ts`: loop de polling; `claimNextPending`; executa `llm "<prompt>"` via `execFile`;
  interpreta saída (IGNORADO→discarded, senão done; erro→error); `finishMemory`. Robusto a falhas.
- `src/index.ts`: entrypoint que sobe servidor + worker como subprocessos no mesmo container.
