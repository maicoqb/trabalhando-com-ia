---
title: estudo-kubernetes
tags: [project, kubernetes, docker, nestjs, nx, typescript, minikube, hpa, keda, prometheus, grafana, rabbitmq, k6, autoscaling]
---

# estudo-kubernetes

Estudo de caso sobre Kubernetes usando uma e-store como exemplo. Parte do Docker, simulando cenários reais de falha e limitações de orquestração, e depois introduz o Kubernetes mostrando como ele resolve os mesmos problemas automaticamente.

## O que é

Uma loja virtual de mentira serve de cenário para comparar Docker e Kubernetes. Cada cenário primeiro expõe uma limitação do Docker "puro" e depois mostra a solução equivalente no K8s (probes, HPA, KEDA, métricas custom).

## Arquitetura

Microsserviços NestJS + PostgreSQL + RabbitMQ, observados por Prometheus/Grafana:

- **products-service** — listagem e busca de produtos.
- **carts-service** — carrinhos; expõe a métrica custom `open_carts`.
- **orders-service** — criação de pedidos; deleta o carrinho via carts-service e publica `order.created`.
- **payments-worker** — consome a fila e processa pagamentos.
- **PostgreSQL** — produtos e pedidos. **RabbitMQ** — fila de mensagens.
- **Prometheus** — coleta métricas. **Grafana** — dashboards.

## Cenários

| # | Cenário | Problema (Docker) | Solução (Kubernetes) |
|---|---------|-------------------|----------------------|
| 0 | Caminho feliz | App funcionando normalmente | App funcionando normalmente |
| 1 | Excesso de chamadas | App degrada, sem reação | HPA escala por CPU |
| 2 | App trava | Container fica "running" mas não responde | Probes detectam e reiniciam |
| 3 | Fila acumula | Workers não dão conta | KEDA escala workers pelo tamanho da fila |
| 4 | Carrinhos abertos | App saudável, mas checkout degrada | HPA escala por métrica custom (`open_carts`) |

## Autoscaling por cenário

- **Excesso de chamadas** → HPA por CPU (50%) escala products-service de 1 a 5 pods.
- **Fila acumula** → KEDA escala payments-worker por `rabbitmq_queue_messages_ready`.
- **Carrinhos abertos** → HPA escala orders-service proativamente por `open_carts` (via Prometheus Adapter).

## Particularidades

- **Monorepo Nx + TypeScript (NestJS)**, containers com Docker Compose (limites de 128M / 0.5 CPU) e cluster local com **Minikube**.
- Load tests com **k6** — cada cenário tem seu perfil (50 VUs, rampa até 500 VUs, burst na fila, etc.).
- App trava via endpoint de caos `/api/chaos/hang`, que congela o event loop — Docker não percebe (fica "running"), livenessProbe do K8s percebe e reinicia.

## Comandos

```sh
npm run docker:start        # sobe a app com Docker Compose
npm run k8s:start           # inicia Minikube e deploya tudo
npm run k8s:deploy          # builda imagem e deploya no Minikube
npm run k8s:pods            # lista pods
npm run test:high-load      # load test — rampa até 500 VUs por 2min
```
