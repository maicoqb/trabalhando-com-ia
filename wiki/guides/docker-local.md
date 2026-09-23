---
title: Ambiente local com Docker Compose
tags: [guide, docker, docker-compose, dockerfile, infra, local-dev]
---

# Guia — Ambiente local com Docker Compose

Como subo o ambiente local nos projetos que usam containers (estudo-kubernetes, estudo-de-caso-arquiteturas-eda). Um `docker-compose` orquestra apps, banco, broker e observabilidade.

## Padrão de Dockerfile (multi-stage)

Apps do monorepo Nx usam um Dockerfile multi-stage parametrizado por `APP_NAME`, então **o mesmo Dockerfile serve todos os apps**:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
ARG APP_NAME
COPY nx.json tsconfig.base.json ./
COPY apps/${APP_NAME} ./apps/${APP_NAME}
RUN npx nx build ${APP_NAME}

FROM node:20-alpine
ARG APP_NAME
WORKDIR /app
COPY --from=builder /app/apps/${APP_NAME}/dist ./
COPY --from=deps /app/node_modules ./node_modules
CMD ["node", "main.js"]
```

No compose, cada serviço passa seu `APP_NAME` como build arg.

## Convenções do compose

- **`.env` para configuração** — usuário/senha/porta de Postgres, RabbitMQ, Grafana vêm de variáveis (`${POSTGRES_USER}`, `${RABBITMQ_USER}`...), com defaults quando fazem sentido (`${GRAFANA_USER:-admin}`).
- **Healthchecks + `depends_on: condition`** — serviços só sobem quando suas dependências estão saudáveis. Ex.: apps esperam `postgres`/`rabbitmq` com `service_healthy`; o seed roda como serviço e os apps esperam `service_completed_successfully`.
- **Limites de recursos** — nos estudos, apps recebem `memory: 128M` e `cpus: "0.5"` de propósito, para provocar degradação sob carga.
- **Infra por volume** — configs de Prometheus/Grafana/Tempo são montadas via `volumes`, não embutidas na imagem.

## Serviços de apoio recorrentes

| Serviço | Imagem | Portas |
|---------|--------|--------|
| PostgreSQL | `postgres:16` | 5432 |
| RabbitMQ | `rabbitmq:3-management` | 5672 (amqp), 15672 (UI) |
| Prometheus | `prom/prometheus` | 9090 |
| Grafana | `grafana/grafana:latest` | 3000 |
| Tempo (tracing) | `grafana/tempo:latest` | 4317 (OTLP) |

## Comandos

Os projetos embrulham o compose em scripts npm:

```sh
npm run docker:start     # estudo-kubernetes: sobe tudo
npm run base:up          # eda: infra base (RabbitMQ, Grafana, Tempo)
npm run fire-and-forget:up   # eda: sobe um padrão específico
```

Direto pelo Docker: `docker compose up -d` / `docker compose down`.
