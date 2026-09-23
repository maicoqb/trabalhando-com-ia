/**
 * MCP de memórias — servidor HTTP (Streamable HTTP transport).
 *
 * Expõe a tool `record_memory(content)` em http://<host>:<port><mcpPath>.
 * A tool grava a memória crua no banco e a enfileira, retornando
 * imediatamente — a coleta nunca bloqueia o cliente esperando o curador.
 *
 * Usamos o modo stateless do StreamableHTTPServerTransport
 * (sessionIdGenerator: undefined): cada requisição POST cria um servidor +
 * transport efêmeros. Isso simplifica a operação e é suficiente para uma tool
 * de escrita fire-and-forget.
 */

import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { config } from "./config.js";
import { MemoryStore } from "./db.js";

const RECORD_MEMORY_DESCRIPTION = [
  "Registra uma MEMÓRIA DURÁVEL sobre os projetos e ferramentas do Maico para",
  'a "Wiki do Maico". Chame esta tool sempre que, durante a interação, surgir',
  "informação que valha a pena reter a longo prazo. Permaneça em silêncio",
  "(NÃO chame) para conteúdo efêmero (conversa trivial, saudações, status",
  "momentâneo, dados que só valem para o instante atual).",
  "",
  "Chame quando surgir:",
  "1. Problema resolvido — um problema foi diagnosticado e solucionado.",
  "2. Achado — algo relevante foi descoberto durante o desenvolvimento.",
  "3. Implementação — algo novo foi construído ou uma parte importante mudou.",
  "4. Decisão técnica — uma escolha entre alternativas; registre o quê e o porquê.",
  "5. Convenção ou preferência — um padrão, estilo ou preferência estabelecido.",
  "6. Restrição — um limite ou requisito que passa a condicionar as soluções.",
  "7. Armadilha — uma abordagem que não funciona; registre o que evitar e por quê.",
  "8. Correção de entendimento — algo tido como verdadeiro se mostrou falso.",
  "",
  "O 'content' deve ser AUTOCONTIDO: escreva a memória de forma que faça",
  "sentido sozinha, sem depender do restante da conversa.",
].join("\n");

/**
 * Cria uma instância de McpServer com a tool record_memory registrada.
 * Uma instância nova é criada por requisição no modo stateless.
 */
export function createMcpServer(store: MemoryStore): McpServer {
  const server = new McpServer(
    { name: "mcp-memorias", version: "1.0.0" },
    {
      instructions:
        'MCP de memórias da "Wiki do Maico". Use record_memory para registrar ' +
        "conhecimento durável sobre os projetos e ferramentas do Maico.",
    },
  );

  server.registerTool(
    "record_memory",
    {
      title: "Registrar memória",
      description: RECORD_MEMORY_DESCRIPTION,
      inputSchema: {
        content: z
          .string()
          .min(1, "content não pode ser vazio")
          .describe(
            "O texto da memória, autocontido. Descreve uma informação durável " +
              "sobre os projetos/ferramentas do Maico.",
          ),
      },
    },
    async ({ content }) => {
      const id = store.enqueue(content);
      return {
        content: [
          {
            type: "text" as const,
            text: `Memória registrada (id=${id}) e enfileirada para curadoria.`,
          },
        ],
      };
    },
  );

  return server;
}

export interface ServerHandle {
  close: () => Promise<void>;
}

export async function startServer(store: MemoryStore): Promise<ServerHandle> {
  const app = express();
  app.use(express.json({ limit: "4mb" }));

  // Healthcheck simples.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", counts: store.counts() });
  });

  // Handler MCP stateless: instancia server+transport por requisição.
  const handleMcp = async (req: Request, res: Response): Promise<void> => {
    try {
      const server = createMcpServer(store);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // modo stateless
      });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[server] erro ao tratar requisição MCP:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Erro interno do servidor" },
          id: null,
        });
      }
    }
  };

  app.post(config.mcpPath, handleMcp);

  // GET/DELETE não são suportados no modo stateless (sem sessão persistente).
  const methodNotAllowed = (_req: Request, res: Response): void => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Método não permitido (modo stateless)" },
      id: null,
    });
  };
  app.get(config.mcpPath, methodNotAllowed);
  app.delete(config.mcpPath, methodNotAllowed);

  return await new Promise<ServerHandle>((resolve) => {
    const httpServer = app.listen(config.port, config.host, () => {
      console.log(
        `[server] MCP de memórias ouvindo em http://${config.host}:${config.port}${config.mcpPath}`,
      );
      resolve({
        close: () =>
          new Promise<void>((res) => httpServer.close(() => res())),
      });
    });
  });
}

// Ponto de entrada quando executado diretamente.
const isMain = process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("server.ts");
if (isMain) {
  const store = new MemoryStore(config.dbPath);
  startServer(store).catch((err) => {
    console.error("[server] falha ao iniciar:", err);
    process.exit(1);
  });

  const shutdown = () => {
    console.log("[server] encerrando...");
    store.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
