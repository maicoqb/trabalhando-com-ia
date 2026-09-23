/**
 * Curador — encapsula a construção do prompt e a invocação do comando `llm`
 * (o LLM-curador que já vem configurado com os MCPs de leitura/escrita da
 * "Wiki do Maico" na imagem node-llm).
 *
 * O comando `llm` recebe o prompt como argumento posicional:
 *
 *     llm "prompt a ser executado"
 *
 * Usamos spawn com um array de argumentos (sem shell) para evitar qualquer
 * injeção via o conteúdo da memória.
 */

import { spawn } from "node:child_process";

/**
 * Monta o prompt do curador para uma memória. O enquadramento é a "Wiki do
 * Maico": a relevância é relativa ao domínio (os projetos e ferramentas do
 * Maico) e ao conhecimento que já existe na wiki — não à qualidade intrínseca
 * da memória.
 */
export function buildCuratorPrompt(content: string): string {
  return [
    'Você é o curador da "Wiki do Maico" — o conhecimento pessoal do Maico',
    "sobre seus projetos e ferramentas. Você tem MCPs de leitura e escrita da",
    "wiki à disposição.",
    "",
    "Avalie a MEMÓRIA abaixo seguindo estes passos:",
    "",
    "1. Consulte a wiki (MCP de leitura) para entender o que já existe e qual é",
    "   o domínio atual do conhecimento do Maico.",
    "2. Decida se a memória AGREGA a esse corpo de conhecimento. A relevância é",
    "   relativa ao domínio do Maico e ao que já está registrado — não à",
    "   qualidade intrínseca da memória. Uma memória bem-formada, porém fora do",
    "   domínio dos projetos/ferramentas do Maico, NÃO deve ser escrita.",
    "3. Se a memória for relevante e agregar: incorpore-a à wiki (MCP de",
    "   escrita), criando uma página nova quando for um tema novo ou fazendo",
    "   merge/atualização em uma página existente quando o tema já existir.",
    "   Evite duplicar conhecimento já presente.",
    "4. Se a memória NÃO agregar (fora do domínio, irrelevante, ou já coberta):",
    "   não escreva nada na wiki.",
    "",
    "Ao final, responda em uma linha começando por uma das etiquetas:",
    '- "MATERIALIZADA: <o que foi criado/atualizado>"',
    '- "DESCARTADA: <motivo>"',
    "",
    "MEMÓRIA:",
    content,
  ].join("\n");
}

export interface CuratorResult {
  ok: boolean;
  /** Saída combinada (stdout + stderr) do comando llm. */
  output: string;
  exitCode: number | null;
}

/**
 * Invoca o comando `llm` passando o prompt como argumento posicional.
 * Resolve com a saída; rejeita apenas em erro de spawn ou timeout.
 */
export function runCurator(
  content: string,
  options: { command: string; timeoutMs: number },
): Promise<CuratorResult> {
  const prompt = buildCuratorPrompt(content);

  return new Promise<CuratorResult>((resolve, reject) => {
    const child = spawn(options.command, [prompt], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(
        new Error(
          `Comando '${options.command}' excedeu o timeout de ${options.timeoutMs}ms`,
        ),
      );
    }, options.timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      resolve({ ok: code === 0, output, exitCode: code });
    });
  });
}
