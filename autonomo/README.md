# MCP de memórias — Wiki do Maico

Um servidor **MCP (Model Context Protocol)** que transforma o conhecimento gerado
durante a interação com agentes de IA em uma **wiki** consultável (a "Wiki do
Maico"). Funciona em dois passos desacoplados:

1. **Coleta** — o cliente de IA chama a tool `record_memory(content)`; a memória
   é gravada **crua** no banco e **enfileirada**. A tool retorna na hora.
2. **Processamento** — um **worker** assíncrono consome a fila e invoca o
   **LLM-curador** (comando `llm`), que consulta a wiki e decide se a memória
   **agrega** ao domínio do Maico — materializando-a (página nova ou merge) ou
   descartando-a.

## Arquitetura

```
Cliente de IA ──record_memory(content)──▶ MCP (HTTP :9000/mcp-memory)
                                             │ grava crua + enfileira (SQLite)
                                             ▼
                                          [ fila ]
                                             │  (assíncrono)
                                             ▼
                                          Worker ──invoca──▶ llm (curador)
                                                                 │ lê/escreve
                                                                 ▼
                                                              Wiki do Maico
```

- `src/server.ts` — servidor HTTP (Streamable HTTP transport) com a tool `record_memory`.
- `src/worker.ts` — worker de polling que processa a fila.
- `src/db.ts` — SQLite (better-sqlite3): armazenamento cru **e** fila numa tabela única (`status`).
- `src/curator.ts` — monta o prompt da Wiki do Maico e invoca o comando `llm`.
- `src/config.ts` — configuração via variáveis de ambiente.

## Como rodar

Pré-requisito: a imagem base `node-llm:latest` disponível localmente (traz Node 22
e o comando `llm`, já configurado com os MCPs de leitura/escrita da wiki).

```bash
docker compose up --build
```

Isso sobe dois serviços (`server` e `worker`) com `network_mode: host` — necessário
porque o `llm` e os MCPs da wiki respondem no `localhost` do host.

O MCP fica disponível em:

```
http://localhost:9000/mcp-memory
```

### Registrar como MCP em um cliente de IA

Configure o cliente para um servidor MCP via HTTP (Streamable HTTP) apontando para
`http://localhost:9000/mcp-memory`. A tool `record_memory` ficará disponível.

### Healthcheck

```bash
curl http://localhost:9000/health
# {"status":"ok","counts":{"pending":0,"processing":0,"done":0,"failed":0}}
```

## Desenvolvimento

```bash
npm install
npm run build      # compila TypeScript -> dist/
npm test           # roda a suíte de testes (node:test)
npm run start:server
npm run start:worker
```

## Variáveis de ambiente

| Variável                  | Default                      | Descrição                              |
|---------------------------|------------------------------|----------------------------------------|
| `MCP_PORT`                | `9000`                       | Porta HTTP do MCP                      |
| `MCP_HOST`                | `0.0.0.0`                    | Bind do servidor                       |
| `MCP_PATH`                | `/mcp-memory`                | Path do endpoint MCP                   |
| `DB_PATH`                 | `./data/memorias.sqlite`     | Arquivo SQLite                         |
| `LLM_COMMAND`             | `llm`                        | Comando do curador                     |
| `WORKER_POLL_INTERVAL_MS` | `2000`                       | Intervalo de polling da fila           |
| `WORKER_MAX_ATTEMPTS`     | `3`                          | Tentativas antes de marcar `failed`    |
| `LLM_TIMEOUT_MS`          | `300000`                     | Timeout da execução do `llm`           |
