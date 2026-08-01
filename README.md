# 🏋️ FichaTreino

App de controle de treino de hipertrofia: PWA offline-first com ciclos de treino
gerados deterministicamente.

Substitui o site estático VitePress que existia neste repo. As fichas em markdown
foram preservadas em [`historico/`](historico/) (DD-A16).

## 🚀 Stack

- **Vite + Vue 3** (Composition API, `<script setup>`) + **Pinia** + **Vue Router**
- **Firebase** — Auth (Google), Realtime Database, Hosting
- **IndexedDB** com outbox próprio — o RTDB web não persiste em disco
- **PWA** — service worker para o shell, IndexedDB para os dados

## 📋 Organização

| Caminho | Conteúdo |
|---|---|
| `src/core/` | Gerador determinístico de ciclos. Zero dependências, sem Vue/Firebase. |
| `src/db/` | IndexedDB, outbox e repositórios |
| `src/firebase/` | Auth, paths e sincronização |
| `src/stores/` | Pinia |
| `src/views/` · `src/components/` | UI |
| `ferramentas/cli.ts` | Inspeção de ciclos fora do app (não entra no bundle) |
| `historico/` | Fichas markdown do site antigo, preservadas |
| `docs/` | Arquitetura e metodologia |

## 💻 Comandos

```bash
npm install

npm run dev        # servidor de desenvolvimento
npm run build      # typecheck + build em dist/
npm run preview    # servir o build
npm test           # testes do core (node --test)

npm run ciclo 2            # imprime o Ciclo 2 em Markdown
npm run ciclo -- --check   # valida catálogo e simula 12 ciclos
npm run ciclo -- --diff 2 3

npm run deploy     # build + firebase deploy --only hosting
```

Emulador local (hosting na porta **5010** — a 5000 é ocupada pelo AirPlay no macOS):

```bash
firebase emulators:start
```

## 📚 Documentação

- [`CLAUDE.md`](CLAUDE.md) — invariantes do projeto e armadilhas conhecidas
- [`docs/ARQUITETURA-APP-V1.md`](docs/ARQUITETURA-APP-V1.md) — arquitetura, DD-A01 a DD-A16
- [`docs/SISTEMA-ROTACAO-V1.md`](docs/SISTEMA-ROTACAO-V1.md) — metodologia de treino, DD-01 a DD-11

## 🎯 Objetivo

Quebrar platôs através da variação de estímulos (tensão mecânica vs. estresse
metabólico) e rotação estratégica de exercícios, com registro de carga confiável
mesmo sem rede — o app é usado na academia, celular na mão, entre séries.
