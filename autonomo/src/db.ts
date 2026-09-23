/**
 * Camada de banco de dados (SQLite via better-sqlite3).
 *
 * Uma única tabela `memories` serve tanto de armazenamento das memórias cruas
 * quanto de fila de processamento — o campo `status` marca o estágio de cada
 * memória. Isso mantém a coleta e o processamento desacoplados: a tool grava
 * com status `pending` e o worker faz a transição de estados.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type MemoryStatus =
  | "pending" // enfileirada, aguardando o worker
  | "processing" // sendo processada pelo curador
  | "done" // processada (materializada ou descartada pelo curador)
  | "failed"; // excedeu o número de tentativas

export interface MemoryRow {
  id: number;
  content: string;
  status: MemoryStatus;
  attempts: number;
  /** Resultado textual reportado pelo curador (quando processada). */
  curator_output: string | null;
  /** Última mensagem de erro (quando falhou). */
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Garante que o diretório do arquivo exista.
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        content       TEXT    NOT NULL,
        status        TEXT    NOT NULL DEFAULT 'pending',
        attempts      INTEGER NOT NULL DEFAULT 0,
        curator_output TEXT,
        last_error    TEXT,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status, id);
    `);
  }

  /**
   * Grava uma memória crua e a enfileira (status pending) atomicamente.
   * Retorna o id gerado.
   */
  enqueue(content: string): number {
    const stmt = this.db.prepare(
      `INSERT INTO memories (content, status) VALUES (?, 'pending')`,
    );
    const info = stmt.run(content);
    return Number(info.lastInsertRowid);
  }

  /**
   * Reivindica atomicamente a próxima memória pendente para processamento,
   * marcando-a como `processing` e incrementando `attempts`. Retorna null se
   * não houver nada pendente. O uso de uma transação IMMEDIATE evita que dois
   * workers peguem a mesma linha.
   */
  claimNext(): MemoryRow | null {
    const claim = this.db.transaction((): MemoryRow | null => {
      const row = this.db
        .prepare(
          `SELECT * FROM memories WHERE status = 'pending' ORDER BY id ASC LIMIT 1`,
        )
        .get() as MemoryRow | undefined;
      if (!row) return null;
      this.db
        .prepare(
          `UPDATE memories
             SET status = 'processing',
                 attempts = attempts + 1,
                 updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(row.id);
      return { ...row, status: "processing", attempts: row.attempts + 1 };
    });
    return claim.immediate();
  }

  markDone(id: number, curatorOutput: string): void {
    this.db
      .prepare(
        `UPDATE memories
           SET status = 'done', curator_output = ?, last_error = NULL, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(curatorOutput, id);
  }

  /**
   * Marca a memória de volta como pendente (retry) ou como falha definitiva,
   * dependendo do número de tentativas versus maxAttempts.
   */
  markFailure(id: number, error: string, maxAttempts: number): MemoryStatus {
    const row = this.db
      .prepare(`SELECT attempts FROM memories WHERE id = ?`)
      .get(id) as { attempts: number } | undefined;
    const attempts = row?.attempts ?? maxAttempts;
    const nextStatus: MemoryStatus =
      attempts >= maxAttempts ? "failed" : "pending";
    this.db
      .prepare(
        `UPDATE memories
           SET status = ?, last_error = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(nextStatus, error, id);
    return nextStatus;
  }

  getById(id: number): MemoryRow | null {
    return (
      (this.db
        .prepare(`SELECT * FROM memories WHERE id = ?`)
        .get(id) as MemoryRow | undefined) ?? null
    );
  }

  counts(): Record<MemoryStatus, number> {
    const rows = this.db
      .prepare(`SELECT status, COUNT(*) as n FROM memories GROUP BY status`)
      .all() as Array<{ status: MemoryStatus; n: number }>;
    const result: Record<MemoryStatus, number> = {
      pending: 0,
      processing: 0,
      done: 0,
      failed: 0,
    };
    for (const r of rows) result[r.status] = r.n;
    return result;
  }

  /**
   * Reenfileira memórias que ficaram presas em `processing` (por exemplo, se o
   * worker morreu no meio). Chamado no startup do worker.
   */
  recoverStuckProcessing(): number {
    const info = this.db
      .prepare(
        `UPDATE memories
           SET status = 'pending', updated_at = datetime('now')
         WHERE status = 'processing'`,
      )
      .run();
    return info.changes;
  }

  close(): void {
    this.db.close();
  }
}
