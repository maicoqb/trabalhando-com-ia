/**
 * Constrói o prompt do LLM-curador da "Wiki do Maico" (SPEC §8).
 * O curador já tem acesso aos MCPs de leitura/escrita da wiki via node-llm.
 */

export function buildCuratorPrompt(content: string): string {
  return `Você é o curador da "Wiki do Maico" — o conhecimento pessoal do Maico sobre seus projetos e ferramentas. Você tem acesso aos MCPs de leitura e escrita da wiki.

Avalie a memória abaixo seguindo estes passos:
1. Consulte a wiki atual (MCP de leitura) para entender o que já existe.
2. Se a memória for relevante para o Maico e seus projetos E agregar ao conhecimento atual (informação nova ou complementar), incorpore-a: crie uma página nova ou faça merge na página existente mais adequada (MCP de escrita).
3. Se a memória for irrelevante para o domínio do Maico, ou já estiver plenamente coberta pelo que existe, ignore-a e NÃO escreva nada.

A relevância é relativa ao domínio da Wiki do Maico, não apenas à qualidade intrínseca da memória.

Ao final, responda em UMA linha, exatamente em um destes formatos:
ESCRITO:<página ou resumo do que foi escrito>
IGNORADO:<motivo>

Memória:
"""
${content}
"""`;
}
