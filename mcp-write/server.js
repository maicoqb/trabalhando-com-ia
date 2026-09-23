// MCP de escrita — mínimo, sem lógica.
// Expõe uma tool `write(path, content)` que apenas grava o conteúdo enviado
// num arquivo de saída. Serve só para verificar se o curador decidiu escrever.

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const OUTPUT_DIR = process.env.WRITE_OUTPUT_DIR ?? '/output';
const PORT = Number(process.env.PORT ?? 9002);

function slugify(path) {
  return path
    .toLowerCase()
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sem-nome';
}

function createServer() {
  const server = new McpServer({ name: 'Wiki do Maico - Escritor', version: '1.0.0' });

  server.registerTool(
    'write',
    {
      description: 'Escreve conteúdo na wiki no caminho indicado.',
      inputSchema: {
        path: z.string().describe('Caminho relativo da página (ex.: projects/foo.md)'),
        content: z.string().describe('Conteúdo a ser escrito'),
      },
    },
    async ({ path, content }) => {
      await mkdir(OUTPUT_DIR, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = join(OUTPUT_DIR, `${timestamp}_${slugify(path)}.md`);
      await writeFile(file, content, 'utf8');
      return { content: [{ type: 'text', text: `ok: gravado em ${file}` }] };
    },
  );

  return server;
}

const app = express();
app.use(express.json());

// Transport por sessão. O initialize gera o mcp-session-id que o cliente
// reusa nas requisições seguintes (e no GET do stream / DELETE de encerramento).
const transports = {};

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  let transport = sessionId ? transports[sessionId] : undefined;

  if (!transport && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId];
    };
    await createServer().connect(transport);
  }

  if (!transport) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Sessão inválida ou ausente' },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

async function handleSession(req, res) {
  const sessionId = req.headers['mcp-session-id'];
  const transport = sessionId ? transports[sessionId] : undefined;
  if (!transport) {
    res.status(400).send('Sessão inválida ou ausente');
    return;
  }
  await transport.handleRequest(req, res);
}

app.get('/mcp', handleSession);
app.delete('/mcp', handleSession);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`mcp-write ouvindo em http://0.0.0.0:${PORT}/mcp`);
});
