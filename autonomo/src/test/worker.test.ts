import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore } from "../db.js";
import { Worker } from "../worker.js";

/**
 * Cria um script `llm` falso que:
 *  - sai com código 0 e imprime "MATERIALIZADA" se o prompt contém "projeto";
 *  - sai com código 0 e imprime "DESCARTADA" caso contrário.
 * (o curador sempre "processa"; a decisão útil/inútil é interna a ele.)
 */
function makeFakeLlm(dir: string): string {
  const path = join(dir, "fake-llm.sh");
  writeFileSync(
    path,
    `#!/bin/bash
prompt="$1"
# A memória é a última linha do prompt (após a etiqueta "MEMÓRIA:").
memory=$(echo "$prompt" | tail -n 1)
if echo "$memory" | grep -qi "maico"; then
  echo "MATERIALIZADA: pagina criada"
else
  echo "DESCARTADA: fora do dominio"
fi
exit 0
`,
  );
  chmodSync(path, 0o755);
  return path;
}

test("worker processa memória útil e a marca como done", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcpmem-"));
  const fakeLlm = makeFakeLlm(dir);
  const store = new MemoryStore(":memory:");
  const id = store.enqueue("Decisão no projeto do Maico: usar SQLite.");

  const worker = new Worker(store, {
    command: fakeLlm,
    timeoutMs: 5000,
    pollIntervalMs: 50,
    maxAttempts: 3,
  });

  const processed = await worker.processOne();
  assert.equal(processed, true);

  const row = store.getById(id);
  assert.equal(row!.status, "done");
  assert.match(row!.curator_output!, /MATERIALIZADA/);
  store.close();
});

test("worker processa memória fora do domínio (curador descarta) e marca done", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcpmem-"));
  const fakeLlm = makeFakeLlm(dir);
  const store = new MemoryStore(":memory:");
  const id = store.enqueue("Hoje o tempo está ensolarado.");

  const worker = new Worker(store, {
    command: fakeLlm,
    timeoutMs: 5000,
    pollIntervalMs: 50,
    maxAttempts: 3,
  });

  await worker.processOne();
  const row = store.getById(id);
  // O curador rodou com sucesso; a memória é 'done' (o descarte é decisão do curador,
  // refletida na saída — não gera escrita na wiki).
  assert.equal(row!.status, "done");
  assert.match(row!.curator_output!, /DESCARTADA/);
  store.close();
});

test("worker faz retry quando o curador falha (exit != 0)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcpmem-"));
  const failLlm = join(dir, "fail-llm.sh");
  writeFileSync(failLlm, `#!/bin/bash\necho "erro" >&2\nexit 1\n`);
  chmodSync(failLlm, 0o755);

  const store = new MemoryStore(":memory:");
  const id = store.enqueue("qualquer memória");

  const worker = new Worker(store, {
    command: failLlm,
    timeoutMs: 5000,
    pollIntervalMs: 50,
    maxAttempts: 2,
  });

  await worker.processOne(); // tentativa 1 -> pending (retry)
  assert.equal(store.getById(id)!.status, "pending");
  await worker.processOne(); // tentativa 2 -> failed
  assert.equal(store.getById(id)!.status, "failed");
  store.close();
});

test("worker.processOne retorna false quando a fila está vazia", async () => {
  const store = new MemoryStore(":memory:");
  const worker = new Worker(store, {
    command: "true",
    timeoutMs: 5000,
    pollIntervalMs: 50,
    maxAttempts: 3,
  });
  assert.equal(await worker.processOne(), false);
  store.close();
});
