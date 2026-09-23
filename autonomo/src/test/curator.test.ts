import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCuratorPrompt, runCurator } from "../curator.js";

test("buildCuratorPrompt enquadra na Wiki do Maico e inclui o conteúdo", () => {
  const prompt = buildCuratorPrompt("Decidi usar SQLite no projeto X.");
  assert.match(prompt, /Wiki do Maico/);
  assert.match(prompt, /relativa ao domínio/i);
  assert.match(prompt, /MATERIALIZADA:/);
  assert.match(prompt, /DESCARTADA:/);
  assert.match(prompt, /Decidi usar SQLite no projeto X\./);
});

test("runCurator captura stdout e sucesso de um comando fake", async () => {
  // Usa 'printf' para simular o llm ecoando um resultado.
  const result = await runCurator("mem", {
    command: "printf",
    timeoutMs: 5000,
  });
  // printf recebe o prompt inteiro como formato; só validamos que rodou ok.
  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
});

test("runCurator reporta falha em comando inexistente", async () => {
  await assert.rejects(
    runCurator("mem", {
      command: "comando-que-nao-existe-xyz",
      timeoutMs: 5000,
    }),
  );
});

test("runCurator respeita timeout", async () => {
  // Script que dorme 2s independente dos argumentos; o timeout de 100ms
  // deve disparar antes e matar o processo.
  const dir = mkdtempSync(join(tmpdir(), "mcpcur-"));
  const slow = join(dir, "slow.sh");
  writeFileSync(slow, `#!/bin/bash\nsleep 2\n`);
  chmodSync(slow, 0o755);
  await assert.rejects(
    runCurator("mem", { command: slow, timeoutMs: 100 }),
    /timeout/i,
  );
});
