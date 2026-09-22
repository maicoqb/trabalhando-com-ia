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

A validação usa dois prompts aplicados ao MCP construído:

- **Memória útil** — um prompt que força a geração de uma memória relevante, que **deve ser guardada** na wiki.
- **Memória inútil** — um prompt que força a geração de uma memória irrelevante, que **deve ser descartada**.

Uma solução efetiva guarda a memória útil e descarta a inútil.

## Resultados

_A ser preenchido ao final do experimento._
