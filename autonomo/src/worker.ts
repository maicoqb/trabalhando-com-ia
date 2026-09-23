/**
 * Worker de processamento — consome a fila de memórias de forma assíncrona e
 * independente da coleta. Para cada memória pendente:
 *
 *   1. Reivindica a memória (status -> processing).
 *   2. Invoca o comando `llm` (curador) com o prompt da Wiki do Maico.
 *   3. O curador consulta a wiki, decide relevância e materializa (ou descarta).
 *   4. Marca a memória como done (com a saída do curador) ou agenda retry/falha.
 *
 * O worker faz polling na fila com um pequeno intervalo. É deliberadamente
 * sequencial (uma memória por vez) para não sobrecarregar o LLM-curador.
 */

import { config } from "./config.js";
import { MemoryStore } from "./db.js";
import { runCurator } from "./curator.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class Worker {
  private running = false;
  private stopped = false;

  constructor(
    private store: MemoryStore,
    private opts: {
      command: string;
      timeoutMs: number;
      pollIntervalMs: number;
      maxAttempts: number;
    },
  ) {}

  /**
   * Processa uma única memória, se houver pendente.
   * Retorna true se processou algo, false se a fila estava vazia.
   */
  async processOne(): Promise<boolean> {
    const memory = this.store.claimNext();
    if (!memory) return false;

    console.log(
      `[worker] processando memória id=${memory.id} (tentativa ${memory.attempts})`,
    );

    try {
      const result = await runCurator(memory.content, {
        command: this.opts.command,
        timeoutMs: this.opts.timeoutMs,
      });

      if (result.ok) {
        this.store.markDone(memory.id, result.output);
        console.log(
          `[worker] memória id=${memory.id} concluída pelo curador.`,
        );
      } else {
        const msg = `curador retornou código ${result.exitCode}: ${result.output}`;
        const status = this.store.markFailure(
          memory.id,
          msg,
          this.opts.maxAttempts,
        );
        console.warn(
          `[worker] memória id=${memory.id} falhou (${status}): ${msg}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = this.store.markFailure(
        memory.id,
        msg,
        this.opts.maxAttempts,
      );
      console.warn(
        `[worker] memória id=${memory.id} erro (${status}): ${msg}`,
      );
    }

    return true;
  }

  /** Loop principal: drena a fila e dorme quando vazia. */
  async run(): Promise<void> {
    this.running = true;
    const recovered = this.store.recoverStuckProcessing();
    if (recovered > 0) {
      console.log(
        `[worker] ${recovered} memória(s) presa(s) em 'processing' foram reenfileiradas.`,
      );
    }
    console.log("[worker] iniciado. Aguardando memórias...");

    while (this.running && !this.stopped) {
      let processedSomething = false;
      try {
        processedSomething = await this.processOne();
      } catch (err) {
        console.error("[worker] erro inesperado no loop:", err);
      }
      // Se processou algo, tenta imediatamente a próxima; senão, dorme.
      if (!processedSomething) {
        await sleep(this.opts.pollIntervalMs);
      }
    }
    console.log("[worker] encerrado.");
  }

  stop(): void {
    this.stopped = true;
    this.running = false;
  }
}

// Ponto de entrada quando executado diretamente.
const isMain =
  process.argv[1]?.endsWith("worker.js") || process.argv[1]?.endsWith("worker.ts");
if (isMain) {
  const store = new MemoryStore(config.dbPath);
  const worker = new Worker(store, {
    command: config.llmCommand,
    timeoutMs: config.llmTimeoutMs,
    pollIntervalMs: config.workerPollIntervalMs,
    maxAttempts: config.maxAttempts,
  });

  const shutdown = () => {
    console.log("[worker] encerrando...");
    worker.stop();
    store.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  worker.run().catch((err) => {
    console.error("[worker] falha fatal:", err);
    process.exit(1);
  });
}
