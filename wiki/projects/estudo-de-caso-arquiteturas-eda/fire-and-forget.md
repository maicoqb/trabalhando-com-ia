---
title: EDA — Fire-and-Forget
tags: [eda, fire-and-forget, event-driven, rabbitmq, async, sem-compensacao]
---

# EDA — Fire-and-Forget

Cada etapa do pedido é um serviço independente que se comunica **exclusivamente por eventos** via RabbitMQ. Nenhum serviço chama outro diretamente; a comunicação é assíncrona e unidirecional. **Não há compensação** — é o padrão mais simples.

## Fluxo

`order.created` → Inventory → `inventory.reserved` → Payment → `payment.processed` → Notification.

## Serviços

| Serviço | Responsabilidade | Publica | Consome |
|---------|------------------|---------|---------|
| **Order API** | Recebe pedido via HTTP e publica evento | `order.created` | — |
| **Inventory** | Reserva estoque | `inventory.reserved` | `order.created` |
| **Payment** | Processa pagamento | `payment.processed` | `inventory.reserved` |
| **Notification** | Notifica o cliente | — | `payment.processed` |

## Particularidades

- Exchanges `topic` por etapa, cada uma com sua fila dedicada.
- Sem tratamento de falha/rollback: se um passo falha, os anteriores não são desfeitos. É justamente o contraste com os padrões Saga.
- Observabilidade via RabbitMQ Management (filas/consumers) e Grafana + Tempo (tracing distribuído).
