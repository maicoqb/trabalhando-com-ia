/**
 * Camada de banco (SQLite) — memórias cruas + fila por status.
 * A "fila" é a própria tabela `memories` filtrada por status='pending'.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

export type MemoryStatus =
  | "pending"
  | "processing"
  | "done"
  | "discarded"
  | "error";

export interface Memory {
  id: number;
  content: string;
  status: MemoryStatus;
  curator_output: string | null;
  created_at: string;
  updated_at: string;
}

// Garante que o diretório do arquivo SQLite exista.
mkdirSync(dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    content        TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'pending',
    curator_output TEXT,
    created_at     TEXT    NOT NULL,
    updated_at     TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status, created_at);
`);

const now = (): string => new Date().toISOString();

/** Insere uma memória crua com status 'pending' e retorna seu id. */
export function insertMemory(content: string): number {
  const ts = now();
  const stmt = db.prepare(
    `INSERT INTO memories (content, status, created_at, updated_at)
     VALUES (?, 'pending', ?, ?)`,
  );
  const info = stmt.run(content, ts, ts);
  return Number(info.lastInsertRowid);
}

/**
 * Reivindica a próxima memória pendente (mais antiga) de forma atômica,
 * transicionando 'pending' → 'processing'. Retorna null se não houver.
 */
export function claimNextPending(): Memory | null {
  const claim = db.transaction((): Memory | null => {
    const row = db
      .prepare(
        `SELECT * FROM memories WHERE status = 'pending'
         ORDER BY created_at ASC, id ASC LIMIT 1`,
      )
      .get() as Memory | undefined;
    if (!row) return null;

    db.prepare(
      `UPDATE memories SET status = 'processing', updated_at = ? WHERE id = ?`,
    ).run(now(), row.id);

    return { ...row, status: "processing" };
  });
  return claim();
}

/** Finaliza uma memória com o status final e a saída do curador. */
export function finishMemory(
  id: number,
  status: MemoryStatus,
  curatorOutput: string | null,
): void {
  db.prepare(
    `UPDATE memories SET status = ?, curator_output = ?, updated_at = ? WHERE id = ?`,
  ).run(status, curatorOutput, now(), id);
}

/** Consulta uma memória por id (útil para testes/auditoria). */
export function getMemory(id: number): Memory | null {
  const row = db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id) as
    | Memory
    | undefined;
  return row ?? null;
}

export default db;
