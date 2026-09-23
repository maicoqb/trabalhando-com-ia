# Especificação — MCP de Memórias (Wiki do Maico)

Documento de especificação derivado de [ESCOPO.md](./ESCOPO.md). Define **requisitos** e
**design** da solução antes da implementação.

## 1. Visão e objetivo

Construir um **MCP (Model Context Protocol)** que captura conhecimento durável gerado durante
interações com agentes de IA e o transforma em uma **wiki** consultável (a "Wiki do Maico").

O sistema tem dois passos desacoplados:

1. **Coleta** (síncrona, não-bloqueante) — o cliente de IA chama a tool `record_memory`; a memória
   crua é persistida e enfileirada; a tool retorna imediatamente.
2. **Processamento** (assíncrono, orientado a fila) — um worker consome memórias pendentes e invoca
   o **LLM-curador** (comando `llm`), que decide se a memória agrega ao domínio da wiki e, em caso
   positivo, a materializa (página nova ou merge) via os MCPs de leitura/escrita da wiki.

**Definição de pronto:** `docker compose up` sobe todo o ambiente; um cliente de IA registra o MCP
em `http://localhost:9000/mcp-memory`; prompts exercitam coleta e processamento sem passos manuais.

## 2. Fronteira (dado vs. construído)

**Dado pronto (não construir):**

- Imagem Docker `node-llm:latest` — Node 22, workdir `/workspace`, entrypoint `llm`.
  - `llm "prompt"` → executa `kiro-cli chat --no-interactive --trust-all-tools "prompt"`.
  - O curador já vem com o **MCP da wiki** configurado (`~/.kiro/settings/mcp.json` →
    `maicoWiki` em `http://localhost:9001/mcp`), que expõe leitura e escrita da wiki.
  - Autenticação do `kiro-cli` vive no host em `~/.local/share/kiro-cli` e `~/.kiro`.

**A construir (entregável):**

- **MCP de memórias** com a tool `record_memory`.
- **Banco de dados** de memórias cruas + fila.
- **Worker** de processamento assíncrono que invoca o `llm`.
- **Empacotamento** (`Dockerfile`, `docker-compose.yml`).

## 3. Requisitos funcionais

- **RF1 — Endpoint MCP:** servir o MCP em `http://localhost:9000/mcp-memory` via HTTP
  (Streamable HTTP transport do `@modelcontextprotocol/sdk`), registrável por clientes de IA.
- **RF2 — Tool `record_memory(content: string)`:** único parâmetro `content` (texto autocontido).
  Descrição orienta o modelo a chamar para conteúdo **durável** e permanecer em silêncio para
  **efêmero** (cobrindo os 8 gatilhos do escopo: problema resolvido, achado, implementação,
  decisão técnica, convenção/preferência, restrição, armadilha, correção de entendimento).
- **RF3 — Persistência crua:** ao receber, gravar a memória crua no banco **antes** do
  processamento, com status inicial `pending`.
- **RF4 — Enfileiramento não-bloqueante:** a memória é enfileirada; a tool retorna imediatamente
  (não espera o curador). A fila é a própria tabela consultada por status.
- **RF5 — Worker assíncrono:** um processo separado consome memórias `pending`, uma a uma, marca
  como `processing`, e invoca o curador.
- **RF6 — Invocação do curador:** o worker executa o comando `llm` passando um prompt que embute a
  memória e enquadra a decisão em torno da "Wiki do Maico".
- **RF7 — Decisão relativa ao domínio:** o prompt instrui o curador a consultar o conhecimento atual
  da wiki (via MCP de leitura) e só escrever se a memória **agregar** ao domínio do Maico.
- **RF8 — Materialização de memória útil:** memória relevante vira página nova ou merge na wiki
  (feito pelo curador via MCP de escrita).
- **RF9 — Descarte de memória inútil:** memória fora do domínio não gera escrita.
- **RF10 — Registro de desfecho:** o worker atualiza o status final da memória (`done` ou
  `discarded`/`error`) e guarda a saída do curador para auditoria.

## 4. Requisitos não-funcionais

- **RNF1 — `network_mode: host`:** os serviços do compose usam rede host para alcançar `llm`/MCPs
  da wiki e o próprio MCP de memórias por `localhost` (portas 9000 e 9001).
- **RNF2 — Um comando:** `docker compose up` sobe tudo, sem passos manuais.
- **RNF3 — Stack:** TypeScript + Node 22; SDK `@modelcontextprotocol/sdk`; banco **SQLite**
  (simples, sem serviço extra; arquivo em volume persistente).
- **RNF4 — Não-bloqueio:** a coleta nunca aguarda o curador.
- **RNF5 — Robustez do worker:** falha ao processar uma memória não derruba o worker; ela é marcada
  `error` e o loop continua.
- **RNF6 — Idempotência de consumo:** o `claim` de uma memória pela transição `pending→processing`
  evita processamento duplicado.

## 5. Arquitetura

### 5.1 Componentes

```
Cliente de IA ──record_memory(content)──► [MCP de memórias :9000/mcp-memory]
                                                │ grava crua + status=pending
                                                ▼
                                          [SQLite: memories]  ◄── fila (status)
                                                ▲
                                                │ consome pending
                                          [Worker]
                                                │ llm "<prompt curador + memória>"
                                                ▼
                                          [llm / LLM-curador] ──► MCP wiki :9001/mcp
                                                                    (read/write) ──► Wiki
```

Ambos os processos (servidor MCP e worker) compartilham o **mesmo arquivo SQLite** e rodam no mesmo
container (via um supervisor simples) ou em containers separados que montam o mesmo volume. Escolha
de design: **um único container** rodando os dois processos, para simplicidade e compartilhamento
direto do arquivo SQLite. O worker invoca `llm` que já está no PATH da imagem `node-llm`.

### 5.2 Fluxo de coleta (síncrono)

1. Cliente chama `record_memory(content)`.
2. Servidor valida `content` (string não vazia).
3. `INSERT` na tabela `memories` (status `pending`).
4. Retorna `{ ok: true, id }` imediatamente.

### 5.3 Fluxo de processamento (assíncrono)

1. Worker faz polling: seleciona a memória `pending` mais antiga e a marca `processing`
   (transição atômica = claim).
2. Monta o prompt do curador embutindo `content`.
3. Executa `llm "<prompt>"` (subprocesso).
4. Interpreta a saída: sucesso → `done`; erro de execução → `error`.
   (A distinção útil/inútil é decidida pelo curador na wiki; o worker registra o resultado textual.)
5. Persiste `result`/`curator_output` e o `status` final. Volta ao passo 1.

## 6. Modelo de dados (SQLite)

Tabela `memories`:

| coluna          | tipo    | descrição                                                        |
|-----------------|---------|------------------------------------------------------------------|
| `id`            | INTEGER | PK autoincremento                                                |
| `content`       | TEXT    | memória crua, autocontida                                        |
| `status`        | TEXT    | `pending` \| `processing` \| `done` \| `discarded` \| `error`    |
| `curator_output`| TEXT    | saída textual do comando `llm` (auditoria)                       |
| `created_at`    | TEXT    | ISO timestamp de criação                                         |
| `updated_at`    | TEXT    | ISO timestamp da última transição                                |

Índice em `status` para o polling da fila. A "fila" é a própria tabela filtrada por `status='pending'`
ordenada por `created_at`.

## 7. Contrato da tool

- **Nome:** `record_memory`
- **Input:** `{ content: string }` (mínimo 1 caractere)
- **Descrição (resumo):** registra uma memória **durável** sobre o trabalho do Maico. Deve ser
  chamada quando surgir informação que vale reter (problema resolvido, achado, implementação,
  decisão técnica, convenção/preferência, restrição, armadilha, correção de entendimento). NÃO deve
  ser chamada para conteúdo efêmero (conversa trivial, estado transitório, ruído).
- **Output:** conteúdo textual confirmando o registro, ex. `Memória registrada (#<id>).`

## 8. Prompt do curador (worker → llm)

O worker passa ao `llm` um prompt que:

- Situa o curador como responsável pela **"Wiki do Maico"** (conhecimento pessoal do Maico sobre
  seus projetos e ferramentas).
- Instrui a **consultar** o conhecimento atual da wiki (MCP de leitura) antes de decidir.
- Instrui a **incorporar** (página nova ou merge via MCP de escrita) somente se a memória agregar
  ao domínio do Maico; caso contrário, **ignorar** sem escrever.
- Embute o conteúdo da memória.

Texto base (parametrizado por `content`):

```
Você é o curador da "Wiki do Maico" — o conhecimento pessoal do Maico sobre seus projetos e
ferramentas. Você tem acesso aos MCPs de leitura e escrita da wiki.

Avalie a memória abaixo:
1. Consulte a wiki atual para entender o que já existe.
2. Se a memória for relevante para o Maico e seus projetos E agregar ao conhecimento atual
   (informação nova ou complementar), incorpore-a: crie uma página nova ou faça merge na página
   existente mais adequada.
3. Se a memória for irrelevante para o domínio do Maico, ou já estiver plenamente coberta, ignore-a
   e não escreva nada.

Ao final, responda em uma linha: ESCRITO:<página> ou IGNORADO:<motivo>.

Memória:
"""
<content>
"""
```

## 9. Empacotamento

- **`Dockerfile`** — base `node-llm:latest`; copia o projeto, instala deps, compila TS, define
  comando que sobe servidor MCP + worker.
- **`docker-compose.yml`** — um serviço `mcp-memory` com `network_mode: host`, build do Dockerfile,
  volume para o arquivo SQLite, e montagem read-only das credenciais do host
  (`~/.kiro`, `~/.local/share/kiro-cli`, `~/.aws`) para o `llm` autenticar, além do
  `~/.kiro/settings/mcp.json` que aponta para o MCP da wiki.
- **Porta:** o MCP escuta em `0.0.0.0:9000` no path `/mcp-memory` (host network → `localhost:9000`).

## 10. Mapeamento com os critérios de aceitação do escopo

| Critério (ESCOPO §Critérios) | Onde é atendido            |
|------------------------------|----------------------------|
| 1. Sobe com docker compose   | §9 (RNF1, RNF2)            |
| 2. Registrável como MCP       | §5.2, RF1                  |
| 3. Expõe `record_memory`      | §7, RF2                    |
| 4. Ativação seletiva          | §7 descrição durável/efêmero|
| 5. Persiste memória crua      | §5.2, RF3                  |
| 6. Dispara o curador          | §5.3, RF6                  |
| 7. Guarda memória útil        | §8, RF8                    |
| 8. Descarta memória inútil    | §8, RF9                    |
| 9. Relevância relativa        | §8, RF7                    |
