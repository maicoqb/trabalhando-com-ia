/**
 * Worker de processamento assíncrono.
 * Consome memórias 'pending', invoca o LLM-curador (comando `llm`) e registra o desfecho.
 * Robusto: erro em uma memória não derruba o loop.
 */

import { execFile } from "node:child_process";
import { config } from "./config.js";
import { claimNextPending, finishMemory, type MemoryStatus } from "./db.js";
import { buildCuratorPrompt } from "./curatorPrompt.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface CuratorResult {
  status: MemoryStatus;
  output: string;
}

/** Invoca `llm "<prompt>"` e captura a saída. */
function runCurator(prompt: string): Promise<CuratorResult> {
  return new Promise((resolve) => {
    execFile(
      config.llmCommand,
      [prompt],
      { timeout: config.llmTimeoutMs, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = `${stdout ?? ""}${stderr ? `\n[stderr]\n${stderr}` : ""}`.trim();
        if (error) {
          resolve({ status: "error", output: `${error.message}\n${output}`.trim() });
          return;
        }
        // O curador decide útil/inútil e escreve na wiki por conta própria.
        // Marcamos 'discarded' quando a saída indica IGNORADO, senão 'done'.
        const status: MemoryStatus = /(^|\n)\s*IGNORADO:/i.test(output)
          ? "discarded"
          : "done";
        resolve({ status, output });
      },
    );
  });
}

async function processOne(): Promise<boolean> {
  const memory = claimNextPending();
  if (!memory) return false;

  console.error(`[worker] processando memória #${memory.id}`);
  try {
    const prompt = buildCuratorPrompt(memory.content);
    const { status, output } = await runCurator(prompt);
    finishMemory(memory.id, status, output);
    console.error(`[worker] memória #${memory.id} → ${status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    finishMemory(memory.id, "error", msg);
    console.error(`[worker] memória #${memory.id} falhou: ${msg}`);
  }
  return true;
}

async function main(): Promise<void> {
  console.error(
    `[worker] iniciado (poll=${config.workerPollIntervalMs}ms, llm='${config.llmCommand}')`,
  );
  // Loop contínuo: processa em rajada enquanto houver pendências, senão dorme.
  for (;;) {
    let processed = false;
    try {
      processed = await processOne();
    } catch (err) {
      console.error("[worker] erro inesperado no loop:", err);
    }
    if (!processed) {
      await sleep(config.workerPollIntervalMs);
    }
  }
}

main().catch((err) => {
  console.error("[worker] erro fatal:", err);
  process.exit(1);
});
