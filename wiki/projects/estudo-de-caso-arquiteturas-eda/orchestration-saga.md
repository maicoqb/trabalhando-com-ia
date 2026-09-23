---
title: EDA — Orchestration Saga
tags: [eda, orchestration-saga, saga, orquestrador, compensacao, rabbitmq, maquina-de-estados]
---

# EDA — Orchestration Saga

Fluxo de pedido com um **orquestrador central** que controla execução e compensação da saga. Os workers são simples: recebem comandos e respondem. O orquestrador mantém o estado e decide o próximo passo.

## Serviços

| Serviço | Responsabilidade |
|---------|------------------|
| **Order API** | Recebe pedido via HTTP e publica `order.created` |
| **Orchestrator** | Controla o fluxo, decide passos e compensações; emite comandos e consome respostas |
| **Inventory** | Reserva/libera estoque sob comando |
| **Payment** | Processa/estorna pagamento sob comando |
| **Shipping** | Agenda envio sob comando |

Comandos: `reserve-inventory`, `process-payment`, `schedule-shipping`, `release-inventory`, `refund-payment`.

## Máquina de estados da saga

```
CREATED → RESERVING_INVENTORY → PROCESSING_PAYMENT → SCHEDULING_SHIPPING → COMPLETED
                ↓                       ↓                      ↓
          RELEASING_INVENTORY ← REFUNDING_PAYMENT ←    COMPENSATING
                ↓                       ↓
             FAILED                  FAILED
```

## Particularidades

- A lógica de fluxo e compensação fica **centralizada** no orquestrador — fácil de enxergar e evoluir, ao custo de um ponto central (contraste com o Choreography Saga).
- Duas exchanges principais: `commands` (orquestrador → workers) e `replies` (workers → orquestrador).
