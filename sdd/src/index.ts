/**
 * Entrypoint do container: sobe o servidor MCP e o worker no mesmo processo host,
 * cada um em um subprocesso Node, compartilhando o mesmo arquivo SQLite.
 * Se qualquer um morrer, o processo encerra (o Docker reinicia o container).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function launch(name: string, script: string): ChildProcess {
  const child = spawn(process.execPath, [join(here, script)], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    console.error(`[index] '${name}' encerrou (code=${code}, signal=${signal})`);
    // Encerra todo o container para que o Docker reinicie de forma consistente.
    process.exit(code ?? 1);
  });
  return child;
}

const server = launch("server", "server.js");
const worker = launch("worker", "worker.js");

function shutdown(signal: NodeJS.Signals): void {
  console.error(`[index] recebido ${signal}, encerrando...`);
  server.kill(signal);
  worker.kill(signal);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
