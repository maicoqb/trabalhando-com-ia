/**
 * Constrói o prompt do LLM-curador da "Wiki do Maico" (SPEC §8).
 * O curador já tem acesso ao(s) MCP(s) da wiki via node-llm (@maicoWiki).
 *
 * O prompt mantém o curador focado nas tools do MCP da wiki (rápido e previsível)
 * e o instrui a materializar memórias relevantes usando a tool de escrita quando
 * ela existir. Se o MCP da wiki não expuser tool de escrita, o curador deve
 * reportar a decisão com honestidade (ESCRITO vs. IGNORADO), sem inventar.
 */

export function buildCuratorPrompt(content: string): string {
  return `Você é o curador da "Wiki do Maico" — o conhecimento pessoal do Maico sobre seus projetos e ferramentas.

Trabalhe usando as tools do MCP @maicoWiki (ex.: list_documents, read_document, search e, se existir, a tool de criação/atualização de documento). Prefira essas tools; não gaste tempo explorando o filesystem.

Passos:
1. Consulte a wiki atual (list_documents / search / read_document) para entender o domínio e o que já existe.
2. Decida se a memória é relevante para o Maico e seus projetos E se agrega ao conhecimento atual (informação nova ou complementar). A relevância é relativa ao domínio da wiki, não apenas à qualidade intrínseca da memória.
3. Se for relevante e houver uma tool de escrita/atualização no @maicoWiki, materialize a memória: crie uma página nova ou faça merge na página existente mais adequada.
4. Se for irrelevante para o domínio, ou já plenamente coberta, não escreva nada.

Seja objetivo e rápido. Ao final, responda em UMA linha, exatamente em um destes formatos:
ESCRITO:<página criada/atualizada>
IGNORADO:<motivo>

Memória:
"""
${content}
"""`;
}
