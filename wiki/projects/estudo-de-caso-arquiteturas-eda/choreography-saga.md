---
title: EDA — Choreography Saga
tags: [eda, choreography-saga, saga, compensacao-distribuida, rabbitmq, coreografia]
---

# EDA — Choreography Saga

Fluxo de pedido com **compensação automática distribuída**. Quando um passo falha, os serviços anteriores escutam os eventos de falha e desfazem suas operações em cascata. **Não existe orquestrador** — cada serviço sabe reagir a sucessos e falhas.

## Serviços

| Serviço | Publica | Consome |
|---------|---------|---------|
| **Order API** | `order.created` | — |
| **Inventory** | `inventory.reserved`, `inventory.released` | `order.created`, `payment.failed`, `payment.refunded` |
| **Payment** | `payment.processed`, `payment.failed`, `payment.refunded` | `inventory.reserved`, `shipping.failed` |
| **Shipping** | `shipping.scheduled`, `shipping.failed` | `payment.processed` |

## Compensação

- **Payment falha:** Payment publica `payment.failed` → Inventory libera estoque (`inventory.released`).
- **Shipping falha:** Shipping publica `shipping.failed` → Payment faz refund (`payment.refunded`) → Inventory libera estoque.

## Particularidades

- A lógica de rollback fica **espalhada** entre os serviços — cada um conhece suas próprias compensações. Flexível, mas difícil de enxergar o fluxo completo (contraste direto com o Orchestration Saga).
- Exchanges `topic` por serviço; alguns eventos existem só para observabilidade.
