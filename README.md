# Trabalhando com IA

Experimento para avaliar três modelos de trabalho com IA na construção de software, usando um mesmo escopo como base de comparação.

## Objetivo

Entender como diferentes formas de colaborar com uma IA afetam o resultado final. Todos os modelos partem do mesmo escopo, para que a única variável em análise seja o **modo de trabalho**, não a tarefa.

## Modelos avaliados

- **Autônomo** — a partir da definição, a IA faz todo o trabalho: implementa, revisa a si mesma, aplica correções e chega ao resultado final sem intervenção humana.
- **SDD (Spec-Driven Development)** — a partir da definição, cria-se uma especificação, que é quebrada em tarefas; a IA implementa tarefa a tarefa até o resultado final.
- **Interativo** — a partir da definição, o humano interage continuamente com a IA, guiando e ajustando até o resultado final.

## Estrutura do repositório

```
README.md        # este documento
ESCOPO.md        # o que é o projeto (mesmo escopo para os três modelos)
autonomo/        # modelo autônomo (AGENT.md + escopo + solução)
sdd/             # modelo SDD (AGENT.md + escopo + solução)
interativo/      # modelo interativo (AGENT.md + escopo + solução)
```

Cada pasta é aberta em um editor separado, com um agente operando apenas naquela pasta, sem visibilidade do projeto como um todo. Assim os modelos não se contaminam entre si.

## Cenário de teste

O projeto usado como cobaia é um **MCP de "LLM Wiki"**: um servidor que constrói uma wiki a partir de memórias coletadas durante a interação com agentes de IA. O processo tem dois passos:

1. **Coleta** — memórias são capturadas ao longo da interação com o agente.
2. **Processamento** — as memórias são processadas para construir a wiki.

O detalhamento completo está no [ESCOPO.md](./ESCOPO.md), que é o mesmo para os três modelos.

## Critérios de avaliação

- **Qualidade do código** — clareza, organização e boas práticas do que foi produzido.
- **Tempo de desenvolvimento** — tempo total, do primeiro ao último commit da pasta.
- **Assertividade** — quanto dos critérios definidos no escopo foi atingido.
- **Efetividade** — quanto da solução (o problema de fato resolvido, funcionando na prática) foi atingido.

### Como a solução é validada

A validação separa **dois eixos independentes**:

- **Ativação** — durante a conversa, o agente reconheceu que havia algo digno de memória e chamou a tool de coleta? É responsabilidade da descrição da tool.
- **Processamento** — dado que a tool foi chamada, o MCP decidiu corretamente entre **guardar** (memória útil) e **descartar** (memória inútil)? É responsabilidade do MCP.

A wiki-semente (a pasta [`wiki/`](./wiki)) é exposta por um **MCP de leitura**, que o MCP de memórias consome para saber o que já está guardado — e, com isso, julgar o que é relevante. Para isso são usados **três prompts**, aplicados em sequência:

**1. Prompt introdutório (baseline)** — conversa neutra, sem nada memorável.

> Oi! Tô voltando a mexer nos meus projetos essa semana. Me lembra rapidinho quais eu tenho por aqui e o que cada um faz?

Prova duas coisas por contraste: (a) **só memórias são enviadas** — aqui a tool **não** deve ativar, mostrando que a coleta é seletiva e não dispara para qualquer mensagem; (b) estabelece uma **conversa em andamento**, para que a ativação dos prompts seguintes aconteça no meio de um diálogo real, não isolada.

**2. Prompt de memória útil** — encadeado após o introdutório.

> No estudo-kubernetes, o HPA por CPU não escalava o products-service mesmo com carga alta. Descobri que era porque o deployment não tinha `resources.requests.cpu` definido — sem request, o HPA não calcula a porcentagem de uso. Adicionei o request e passou a escalar.

Esperado: a tool **ativa** (é um problema resolvido, no domínio da wiki) e o processamento **guarda** a memória.

**3. Prompt de memória inútil** — encadeado após o introdutório.

> Hoje perdi um tempão tentando compilar um projeto em Rust — o borrow checker reclamava de um valor movido dentro de um loop. Resolvi clonando o valor antes.

Esperado: a tool **ativa** (tem forma de armadilha/achado), mas o processamento **descarta** — o assunto está fora do domínio da wiki (nenhum projeto usa Rust) e não agrega ao que já está guardado.

O par útil/inútil tem propositalmente a **mesma forma** (ambos "resolvi um problema"); o que os separa é apenas a relevância ao domínio existente — justamente o que o MCP precisa saber julgar no processamento.

Uma solução é **efetiva** quando guarda a memória útil e descarta a inútil; e demonstra **ativação correta** quando dispara a tool nos casos 2 e 3 e permanece em silêncio no caso 1.

## Resultados

_A ser preenchido ao final do experimento._
