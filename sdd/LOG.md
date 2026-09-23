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
