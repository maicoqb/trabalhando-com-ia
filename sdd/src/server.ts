/**
 * Servidor MCP de memórias.
 * Expõe a tool `record_memory` via Streamable HTTP em :9000/mcp-memory.
 * A coleta é não-bloqueante: grava a memória crua (status=pending) e retorna já.
 *
 * Usa o servidor HTTP nativo do Node (sem express) para evitar dependências extras
 * e problemas de bind observados com express neste ambiente.
 */

import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { config } from "./config.js";
import { insertMemory } from "./db.js";

const RECORD_MEMORY_DESCRIPTION = `Registra uma MEMÓRIA DURÁVEL sobre o trabalho do Maico para alimentar a "Wiki do Maico".

Chame esta tool sempre que surgir informação que vale a pena reter a longo prazo:
- Problema resolvido: um problema foi diagnosticado e solucionado.
- Achado: algo relevante foi descoberto durante o desenvolvimento.
- Implementação: algo novo foi construído ou uma parte importante mudou.
- Decisão técnica: uma escolha entre alternativas — registre o quê e por quê.
- Convenção ou preferência: um padrão, estilo ou preferência foi estabelecido.
- Restrição: um limite ou requisito que passa a condicionar as soluções.
- Armadilha: uma abordagem que não funciona — registre o que evitar e por quê.
- Correção de entendimento: algo antes tido como verdadeiro se mostrou falso.

NÃO chame para conteúdo EFÊMERO (conversa trivial, saudações, estado transitório,
passos intermediários sem valor duradouro, ruído). No silêncio quando não houver
memória durável.

O parâmetro 'content' deve ser um texto AUTOCONTIDO: compreensível por si só, sem
depender do contexto da conversa. A tool retorna imediatamente; o processamento
(curadoria e escrita na wiki) acontece de forma assíncrona.`;

const inputSchema = {
  content: z
    .string()
    .min(1, "content não pode ser vazio")
    .describe(
      "Texto autocontido da memória durável a ser registrada na Wiki do Maico.",
    ),
};

function buildServer(): McpServer {
  const server = new McpServer({
    name: "memory-mcp-server",
    version: "1.0.0",
  });

  server.registerTool(
    "record_memory",
    {
      title: "Registrar memória",
      description: RECORD_MEMORY_DESCRIPTION,
      inputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ content }: { content: string }) => {
      const id = insertMemory(content.trim());
      console.error(`[server] memória registrada #${id} (enfileirada)`);
      return {
        content: [
          { type: "text" as const, text: `Memória registrada (#${id}).` },
        ],
      };
    },
  );

  return server;
}

/** Lê o corpo bruto da requisição e faz parse JSON (undefined se vazio). */
function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const limit = 1024 * 1024; // 1MB
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function handleMcp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error" },
        id: null,
      }),
    );
    return;
  }

  // Transporte stateless: uma instância nova por requisição evita colisão de IDs.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

function main(): void {
  const server = http.createServer((req, res) => {
    const url = req.url ?? "";
    const path = url.split("?")[0];

    if (path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (path === config.mcpPath) {
      handleMcp(req, res).catch((err) => {
        console.error("[server] erro no handler MCP:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal error" },
              id: null,
            }),
          );
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(config.port, config.host, () => {
    console.error(
      `[server] MCP de memórias em http://localhost:${config.port}${config.mcpPath}`,
    );
  });
}

main();
