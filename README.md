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

npm run dev        # servidor de desenvolvimento — porta 5199
npm run build      # typecheck + build em dist/
npm run preview    # servir o build — porta 5200
npm test           # todos os testes
npm run test:core  # só o core (node --test, sem mock)
npm run test:app   # só as camadas de app (Vitest)

npm run ciclo 2            # imprime o Ciclo 2 em Markdown
npm run ciclo -- --check   # valida catálogo e simula 12 ciclos
npm run ciclo -- --diff 2 3

npm run icones     # rasteriza assets/icones/*.svg -> public/icones/*.png
npm run deploy     # build + firebase deploy --only hosting
```

## ⚠️ Antes do primeiro login em qualquer ambiente

Semeie a metodologia. As regras validam `config.metodologiaVersao` contra
`/metodologia`, então sem esse nó a primeira escrita de config de um usuário
novo é recusada com `PERMISSION_DENIED` — e a fila de sincronização congela na
operação travada, sem nada subir.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./chave-servico.json
npm run seed -- --conferir   # compara com o bundle
npm run seed                 # publica
npm run seed -- --emulador   # mesma coisa, no emulador local
```

As portas são fixas de propósito: o escopo de um service worker é a origem
inteira, então um projeto Vite com PWA na 5173 padrão sequestra o shell de
qualquer outro app servido na mesma porta.

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
