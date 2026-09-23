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

## Passo 7 — Empacotamento Docker (T7)

- `Dockerfile`: base `node-llm:latest`, `npm ci`, `npm run build`, `ENTRYPOINT []` (sobrescreve o
  `llm` da base) e `CMD ["node","dist/index.js"]`. `llm` continua no PATH para o worker.
- `docker-compose.yml`: serviço `mcp-memory` com `network_mode: host`, volume `memory-data:/data`
  e envs (DB_PATH, PORT, MCP_PATH, HOST).
- **Achado importante:** a imagem `node-llm` **já traz a autenticação do kiro-cli e o
  `~/.kiro/settings/mcp.json`** apontando para o MCP da wiki (`localhost:9001/mcp`). Verifiquei com
  `docker run --rm --network host node-llm:latest "responda apenas OK"` → retornou `OK`. O host NÃO
  tem `~/.kiro/settings/mcp.json`. Portanto NÃO montamos credenciais do host: isso sobrescreveria a
  config pronta da wiki e quebraria a curadoria. Basta `network_mode: host` + volume do banco.
- `.dockerignore` criado. `docker compose build` conclui com sucesso (npm ci + tsc dentro do Docker).

## Passo 8 — Verificação end-to-end (T8)

Executado dentro do Docker (`docker compose up -d`), onde o filesystem é Linux nativo.

- **Sobe com um comando:** `docker compose up` levanta o serviço; logs mostram
  `[server] MCP de memórias em http://localhost:9000/mcp-memory` e `[worker] iniciado`.
- **Registrável como MCP:** `initialize` retorna `serverInfo` corretamente; `tools/list` lista
  `record_memory` com o parâmetro `content` e a descrição durável/efêmero.
- **Coleta não-bloqueante:** `tools/call record_memory` retorna `Memória registrada (#id)` na hora.
- **Persistência crua:** a memória aparece no SQLite com status `pending` e o worker a transiciona
  para `processing` (claim atômico).
- **Dispara o curador:** os logs do curador mostram chamadas às tools `@maicoWiki` (`list_documents`,
  `read_document`, `search`, `get_project_info`) — o worker invoca o `llm` com sucesso.
- **Relevância relativa ao domínio (descarte correto):** memórias fora do domínio do Maico foram
  corretamente `discarded` (ex.: "A capital da França é Paris..." e "O gato do vizinho miou...",
  ambas com `IGNORADO:` explicando a falta de relação com os projetos do Maico).
- **Robustez:** falha/timeout ao processar uma memória marca `error`/`discarded` e o worker continua
  (novas memórias seguem sendo processadas).

### Armadilhas resolvidas durante a verificação
- **Curador lento por exploração excessiva:** na 1ª execução o curador rodava `find /`, lia arquivos
  do projeto etc., estourando o timeout. Ajustei `src/curatorPrompt.ts` para focar nas tools do
  `@maicoWiki` e não explorar o filesystem → curadoria passou a rodar em ~10–60s.

### Limite do ambiente (fora do escopo controlável)
- O MCP `@maicoWiki` fornecido expõe **apenas tools de leitura** (`search`, `read_document`,
  `list_documents`, `get_project_info`, `get_document_outline`) — verificado via `tools/list` direto
  em `http://localhost:9001/mcp`. Não há tool de escrita/criação. Por isso, mesmo quando o curador
  julga a memória **relevante e nova**, ele não consegue materializar a página e reporta
  `IGNORADO:relevante, mas o MCP @maicoWiki não expõe tool de escrita`. A escrita (critério 7)
  depende dessa tool no MCP da wiki; o restante do fluxo (coleta, persistência, fila, worker,
  invocação do curador e decisão relativa ao domínio) está funcionando e verificado.

## Conclusão

Solução funcionando de ponta a ponta e pronta para uso via `docker compose up`. O MCP de memórias
coleta e persiste memórias cruas, o worker aciona o LLM-curador da Wiki do Maico, que consulta a
wiki e decide relevância relativa ao domínio. A materialização de páginas fica condicionada à
existência de uma tool de escrita no MCP da wiki (ausente no ambiente atual).
