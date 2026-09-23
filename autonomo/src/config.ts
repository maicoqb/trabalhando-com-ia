/**
 * Configuração centralizada, lida do ambiente com defaults sensatos.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envStr(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === "" ? fallback : raw;
}

export const config = {
  /** Porta HTTP em que o MCP de memórias é servido. */
  port: envInt("MCP_PORT", 9000),

  /** Host de bind do servidor HTTP. */
  host: envStr("MCP_HOST", "0.0.0.0"),

  /** Caminho (path) do endpoint MCP. */
  mcpPath: envStr("MCP_PATH", "/mcp-memory"),

  /** Caminho do arquivo SQLite. */
  dbPath: envStr("DB_PATH", "./data/memorias.sqlite"),

  /** Comando do LLM-curador (dado pronto pela imagem node-llm). */
  llmCommand: envStr("LLM_COMMAND", "llm"),

  /** Intervalo (ms) entre varreduras da fila pelo worker. */
  workerPollIntervalMs: envInt("WORKER_POLL_INTERVAL_MS", 2000),

  /** Máximo de tentativas de processamento por memória. */
  maxAttempts: envInt("WORKER_MAX_ATTEMPTS", 3),

  /** Timeout (ms) para a execução do comando llm. */
  llmTimeoutMs: envInt("LLM_TIMEOUT_MS", 300_000),
} as const;

export type Config = typeof config;
