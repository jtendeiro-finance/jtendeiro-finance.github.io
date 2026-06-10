# Assistente CFO

O diretor financeiro virtual para PMEs portuguesas — de barbearias a startups,
restaurantes e indústria. Disponível em **https://jtendeiro-finance.github.io**.

## O que faz

- **Painel financeiro** — tesouraria, receitas vs. despesas, margem, runway e alertas.
- **Movimentos** — importação de extratos bancários (CSV, formatos PT) e do
  **SAF-T (PT)** da faturação, com categorização automática.
- **Faturas com IA** — fotografe uma fatura com o telemóvel; é guardada em PDF e a IA
  extrai fornecedor, NIF, montantes, IVA e categoria.
- **Previsão semanal de pagamentos** — faturas por vencer, salários, IVA, TSU e
  despesas recorrentes, com saldo projetado a 8 semanas.
- **Conciliação bancária** — cruza automaticamente faturas e movimentos do extrato,
  com relatório de pendentes.
- **Calendário fiscal português** — IVA, e-Fatura, DMR, TSU, retenções, Modelo 22,
  IES, pagamentos por conta, Modelo 10, inventários, IRS Modelo 3 e subsídios,
  gerado a partir do perfil da empresa.
- **CFO virtual (IA)** — chat e «Análise do CFO» mensal com base nos números reais
  da empresa, em português de Portugal.

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind, publicado no GitHub Pages |
| Autenticação e dados | Firebase Auth + Firestore (regras por utilizador) |
| Documentos | Firebase Storage (PDFs das faturas) |
| IA | Cloud Functions (`europe-west1`) → API Anthropic (Claude), com limites diários por utilizador |

Configuração completa em **[SETUP.md](SETUP.md)**.

## Desenvolvimento

```bash
npm install
npm run dev    # servidor local
npm test       # testes unitários
npm run build  # build de produção
```

> ⚠️ O Assistente CFO dá orientação geral de gestão; não substitui o contabilista
> certificado. Confirme sempre prazos e obrigações fiscais.
