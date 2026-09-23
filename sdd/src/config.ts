/**
 * Configuração central do MCP de memórias.
 * Valores vêm de variáveis de ambiente com defaults alinhados ao ESCOPO/SPEC.
 */

export const config = {
  /** Porta HTTP do servidor MCP (ESCOPO: :9000). */
  port: parseInt(process.env.PORT ?? "9000", 10),

  /** Path do endpoint MCP (ESCOPO: /mcp-memory). */
  mcpPath: process.env.MCP_PATH ?? "/mcp-memory",

  /** Interface de bind (host network → localhost). */
  host: process.env.HOST ?? "0.0.0.0",

  /** Caminho do arquivo SQLite (persistido em volume). */
  dbPath: process.env.DB_PATH ?? "/data/memories.db",

  /** Comando do LLM-curador fornecido pela imagem node-llm. */
  llmCommand: process.env.LLM_COMMAND ?? "llm",

  /** Intervalo de polling da fila pelo worker (ms). */
  workerPollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? "3000", 10),

  /** Timeout de execução do comando llm (ms). */
  llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS ?? "300000", 10),
} as const;
