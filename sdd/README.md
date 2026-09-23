# MCP de Memórias — Wiki do Maico

MCP (Model Context Protocol) que captura conhecimento durável durante interações com agentes
de IA e o encaminha a um LLM-curador que decide se a memória agrega à **Wiki do Maico**.

Construído por Spec-Driven Development: veja [SPEC.md](./SPEC.md) (especificação),
[TASKS.md](./TASKS.md) (plano) e [LOG.md](./LOG.md) (registro dos passos).

## Arquitetura

- **Servidor MCP** (`src/server.ts`) — Streamable HTTP em `http://localhost:9000/mcp-memory`,
  expõe a tool `record_memory(content)`. Grava a memória crua em SQLite (`pending`) e retorna
  imediatamente (coleta não-bloqueante).
- **Worker** (`src/worker.ts`) — consome memórias `pending`, invoca o comando `llm` (LLM-curador)
  com o prompt de curadoria (`src/curatorPrompt.ts`), e registra o desfecho (`done`/`discarded`/`error`).
- **Banco** (`src/db.ts`) — SQLite (`/data/memories.db`), tabela `memories` usada também como fila.
- **Entrypoint** (`src/index.ts`) — sobe servidor + worker no mesmo container.

## Como executar

```bash
docker compose up --build
```

Isso sobe o serviço com `network_mode: host` (necessário para o curador alcançar o MCP da wiki
em `localhost:9001` e para o MCP de memórias responder em `localhost:9000`).

### Registrar em um cliente de IA

Aponte o cliente MCP para:

```
http://localhost:9000/mcp-memory
```

### Testar manualmente (JSON-RPC)

```bash
# handshake
curl -s -X POST http://localhost:9000/mcp-memory \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"1"}}}'

# registrar memória
curl -s -X POST http://localhost:9000/mcp-memory \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"record_memory","arguments":{"content":"..."}}}'
```

## Configuração (variáveis de ambiente)

| Variável                 | Default            | Descrição                          |
|--------------------------|--------------------|------------------------------------|
| `PORT`                   | `9000`             | Porta HTTP do MCP                  |
| `MCP_PATH`               | `/mcp-memory`      | Path do endpoint MCP               |
| `HOST`                   | `0.0.0.0`          | Interface de bind                  |
| `DB_PATH`                | `/data/memories.db`| Arquivo SQLite                     |
| `LLM_COMMAND`            | `llm`              | Comando do curador                 |
| `WORKER_POLL_INTERVAL_MS`| `3000`             | Intervalo de polling da fila       |
| `LLM_TIMEOUT_MS`         | `300000`           | Timeout do curador (ms)            |

## Nota sobre a escrita na wiki

A imagem `node-llm` traz o curador com o MCP `@maicoWiki` já configurado. No ambiente verificado,
esse MCP expõe **apenas tools de leitura** (`list_documents`, `read_document`, `search`,
`get_project_info`, `get_document_outline`). Assim, o curador consulta a wiki e decide corretamente
o que é relevante para o domínio do Maico (descartando o irrelevante), mas a materialização de
páginas depende de o MCP da wiki oferecer uma tool de escrita. Quando uma tool de escrita estiver
disponível, o curador a utilizará conforme o prompt em `src/curatorPrompt.ts`.
