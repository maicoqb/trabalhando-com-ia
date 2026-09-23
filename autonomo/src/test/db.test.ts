import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../db.js";

test("enqueue persiste memória crua como pending", () => {
  const store = new MemoryStore(":memory:");
  const id = store.enqueue("uma memória durável");
  const row = store.getById(id);
  assert.ok(row);
  assert.equal(row!.content, "uma memória durável");
  assert.equal(row!.status, "pending");
  assert.equal(row!.attempts, 0);
  store.close();
});

test("claimNext reivindica em ordem FIFO e marca processing", () => {
  const store = new MemoryStore(":memory:");
  const id1 = store.enqueue("primeira");
  const id2 = store.enqueue("segunda");

  const claimed = store.claimNext();
  assert.ok(claimed);
  assert.equal(claimed!.id, id1);
  assert.equal(claimed!.status, "processing");
  assert.equal(claimed!.attempts, 1);

  const claimed2 = store.claimNext();
  assert.equal(claimed2!.id, id2);

  // Fila vazia agora.
  assert.equal(store.claimNext(), null);
  store.close();
});

test("markDone move para done com a saída do curador", () => {
  const store = new MemoryStore(":memory:");
  const id = store.enqueue("memória");
  store.claimNext();
  store.markDone(id, "MATERIALIZADA: página X");
  const row = store.getById(id);
  assert.equal(row!.status, "done");
  assert.equal(row!.curator_output, "MATERIALIZADA: página X");
  store.close();
});

test("markFailure agenda retry até maxAttempts, depois falha", () => {
  const store = new MemoryStore(":memory:");
  const id = store.enqueue("memória");

  // Tentativa 1
  store.claimNext();
  let status = store.markFailure(id, "erro 1", 2);
  assert.equal(status, "pending"); // ainda pode tentar

  // Tentativa 2 (atinge maxAttempts)
  store.claimNext();
  status = store.markFailure(id, "erro 2", 2);
  assert.equal(status, "failed");

  const row = store.getById(id);
  assert.equal(row!.status, "failed");
  assert.equal(row!.last_error, "erro 2");
  store.close();
});

test("recoverStuckProcessing reenfileira memórias presas", () => {
  const store = new MemoryStore(":memory:");
  store.enqueue("a");
  store.enqueue("b");
  store.claimNext(); // uma vira processing
  const recovered = store.recoverStuckProcessing();
  assert.equal(recovered, 1);
  assert.equal(store.counts().pending, 2);
  store.close();
});
