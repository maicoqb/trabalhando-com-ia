---
title: estudo-de-caso-arquiteturas-eda
tags: [project, eda, event-driven, rabbitmq, saga, nx, typescript, opentelemetry, tracing, docker]
---

# estudo-de-caso-arquiteturas-eda

Estudo de caso prático sobre **arquiteturas orientadas a eventos (EDA)**. Implementa e compara diferentes padrões de EDA sobre o mesmo fluxo de pedido de compra, observando o comportamento de cada modelo na prática.

## O que é EDA

Estilo arquitetural onde os componentes se comunicam por eventos. Em vez de chamadas diretas, um produtor publica um evento em um broker (RabbitMQ) e consumidores reagem de forma assíncrona e desacoplada. Ganha-se escalabilidade, independência e resiliência; em troca vêm os desafios de consistência eventual, tratamento de falhas e observabilidade.

## Padrões estudados

Todos usam o mesmo cenário (fluxo de pedido) e a mesma `order-api` compartilhada:

- **[Fire-and-Forget](./fire-and-forget.md)** — eventos unidirecionais, sem compensação.
- **[Choreography Saga](./choreography-saga.md)** — compensação distribuída; cada serviço reage a falhas.
- **[Orchestration Saga](./orchestration-saga.md)** — orquestrador central controla passos e compensações.

## Stack

- **Monorepo Nx + TypeScript**
- **Broker:** RabbitMQ
- **Tracing:** OpenTelemetry → Grafana Tempo
- **Infra:** Docker Compose

## Como rodar

```bash
npm run base:up                        # infra base (RabbitMQ, Grafana, Tempo)
npm run fire-and-forget:up             # sobe um padrão (docker)
npm run fire-and-forget:create-orders  # gera pedidos
```

Cada padrão tem seus equivalentes `:serve` (dev local), `:up` (docker) e `:create-orders`.

## Acessos

| Serviço | URL | Credenciais |
|---------|-----|-------------|
| RabbitMQ Management | http://localhost:15672 | guest / guest |
| Grafana (Traces) | http://localhost:3000 | admin / admin |
| Order API | http://localhost:3001 | — |
