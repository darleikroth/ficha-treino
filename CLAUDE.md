# CLAUDE.md — FichaTreino

App de controle de treino de hipertrofia. Refatoração do site estático
`fichatreinos.web.app` em PWA offline-first com ciclos de treino gerados
deterministicamente.

**Stack:** Vite · Vue 3 (Composition API, `<script setup>`) · Pinia · Vue Router ·
Firebase (Auth Google, Realtime Database, Hosting) · IndexedDB · PWA

**Idioma:** todo código, comentário, commit e UI em pt-BR.

**Ponto de partida:** o repo hoje é um site VitePress (markdown em `src/`,
tema em `.vitepress/`). A migração para SPA é a Fase 0 e é **destrutiva sobre o
`src/` atual** — mova `src/days/**` para `historico/` antes de qualquer scaffold
(DD-A13, DD-A16).

---

## Documentos de referência

Leia antes de implementar. Não reinvente decisões que já estão tomadas nestes dois
arquivos.

| Arquivo | Conteúdo |
|---|---|
| `docs/ARQUITETURA-APP-V1.md` | Arquitetura do app. DD-A01 a DD-A12, modelo de dados RTDB, regras de segurança, camadas, offline-first, contratos das stores, ordem de implementação com checkpoints. |
| `docs/SISTEMA-ROTACAO-V1.md` | Metodologia de treino. DD-01 a DD-11, estrutura de slots, pools de exercícios, regras de rotação. É a especificação que `src/core/` implementa. |

Quando uma decisão precisar mudar, edite o documento e bumpe a versão. Não deixe
código e documento divergirem em silêncio.

---

## As seis invariantes

Estas regras são o que mantém o offline funcionando e o histórico legível. Violar
qualquer uma delas produz bug que só aparece em produção, offline, dias depois.
Todas as outras decisões do projeto são negociáveis.

### 1. `src/core/` não importa Vue, Pinia nem Firebase (DD-A01)
`core/` é a única parte do sistema com lógica de metodologia, e precisa ser testável
com `node --test` puro, sem mock. Se ele passar a depender de framework, a
metodologia fica impossível de validar isoladamente.

*Validar:* `grep -rE "from ['\"](vue|pinia|firebase)" src/core/` deve retornar vazio.

### 2. A UI lê do IndexedDB, nunca de listener RTDB direto (DD-A02)
Listeners RTDB escrevem no IndexedDB; a UI reage ao IndexedDB. Caminho de leitura
idêntico online e offline. É isso que elimina a classe de bug "funciona online,
quebra offline".

*Validar:* nenhum `onValue`/`get` do Firebase importado em `src/views/` ou
`src/components/`.

### 3. Toda escrita passa pelo outbox (DD-A02)
`UI → IndexedDB → outbox → RTDB`. Nunca `UI → RTDB`. A UI faz commit local e não
espera rede. A drenagem é **sequencial e em ordem de inserção** — paralelizar quebra
a causalidade entre "criar sessão" e "adicionar série a ela".

*Validar:* `set`/`update`/`remove` do RTDB só aparecem em `src/firebase/sync.ts`.

### 4. Séries gravam `exercicioNome` literal, não só o id (DD-A05)
Cada série persiste `exercicioId`, `exercicioNome` e `metodologiaVersao`. Desacopla
o histórico da metodologia: dá para descartar uma versão antiga do RTDB sem
corromper sessões, e o gráfico de progressão continua legível se o id sair do
catálogo.

### 5. `views/` importa apenas `stores/`
Regra de dependência, de dentro para fora:
`core` ← `db` ← `firebase/sync` ← `stores` ← `views`.
Views não importam `db/` nem `firebase/` diretamente.

### 6. Séries e reps de slot nunca mudam em runtime (DD-02)
O volume semanal por grupo muscular é invariante **por construção**, não por
verificação. A rotação troca *qual exercício ocupa o slot*, nunca quantas séries ele
tem. Alterar volume é editar `src/core/estrutura.ts` e bumpar a versão da
metodologia — nunca uma operação de runtime nem por ciclo.

---

## Por que o determinismo importa

`gerarCiclo(n)` é função pura de `(metodologia, n)`. **O treino de hoje não é dado
armazenado** — é computado no cliente.

Consequências que você deve preservar ao implementar:

- Não existe "baixar o treino do servidor". Não crie esse caminho.
- Não armazene ciclos gerados no RTDB. Armazene `cicloAtual` (um número) e
  `overrides` (raro).
- Em Pinia, `ciclo` e `treino` são `computed` sobre o gerador. Nenhum estado
  derivado precisa ser invalidado ou re-sincronizado.
- O estado que realmente sincroniza é pequeno: `config`, `overrides`, `cargas`,
  `sessoes`. É isso que torna o offline tratável.

---

## Armadilhas conhecidas

Estas já custaram análise. Não redescubra.

| Armadilha | O que fazer |
|---|---|
| **O Web SDK do RTDB não persiste em disco.** `setPersistenceEnabled` só existe no Android/iOS. Cache do browser é em memória e morre no reload. | IndexedDB próprio com outbox. É o motivo de DD-A02 existir. Não tente configurar persistência do RTDB. |
| Firebase Hosting cacheia `index.html` e `sw.js` agressivamente | `Cache-Control: no-cache` nesses dois no `firebase.json`; assets com hash recebem `immutable` (DD-A11) |
| `signInWithRedirect` quebra com bloqueio de cookies de terceiros | `signInWithPopup`. `authDomain` é o próprio domínio, então é same-origin (DD-A12) |
| Guard de rota pisca `/login` no boot offline | esperar a resolução de `onAuthStateChanged` antes de decidir; não redirecionar durante `carregando` |
| `setInterval` é throttled em background e o timer de descanso atrasa | calcular por `Date.now()`, nunca acumular ticks |
| RTDB não garante ordem de chaves, e a ordem dos slots é semântica (DD-06 exige T1–T3 antes de T4/T5) | `deRtdb()` reordena — já implementado e testado com chaves embaralhadas |
| `sessoes` cresce sem limite | nunca ler o nó inteiro; `query(ref, orderByKey(), limitToLast(30))` |
| Trocar metodologia no meio de um ciclo invalida cargas em progresso | bloquear troca com ciclo em andamento (DD-A03) |
| **`metodologiaVersao` versiona os dados, não o código do gerador.** Corrigir o gerador muda a saída sem que a metodologia mude uma linha | `config.geradorVersao` pinado junto; mudança de gerador que altere saída é bloqueada no meio de ciclo, igual DD-A03 · DD-A17 |
| Ressincronizar `src-core/` sobrescreve os ajustes de layout do repo | após copiar para `src/core/`, reaponte os imports de `ferramentas/cli.ts` para `../src/core/` |
| **Service worker de outro projeto na porta 5173.** O escopo de um SW é a origem inteira, e 5173 é o default de todo projeto Vite: um app com PWA registrado ali passa a servir o shell dele no lugar do nosso — o app some e sobra o cache do vizinho, com os módulos ainda vindo da rede (o que disfarça o sintoma) | portas fixas próprias: dev **5199**, preview **5200** (`vite.config.ts`) |
| `await` de algo que não é requisição do IDB dentro de uma transação a fecha no meio | em `comTransacao`, só encadeie `await pedido(...)`; emita requisições paralelas antes do primeiro `await` |
| **O snippet web do Firebase não traz `databaseURL`** enquanto o RTDB não existir. Sem ela o app sobe, o login funciona e a primeira escrita morre calada | `VITE_FIREBASE_DATABASE_URL` é obrigatória e validada em `firebase/app.ts`, que falha alto no boot |
| Comparar o JSON do RTDB com o do bundle dá falso positivo: mapa de chaves inteiras contíguas volta como **array** (foi o caso de `progressao`) | comparar depois de `deRtdb()`, e conferir os ciclos gerados — não os bytes |
| O flash de `/login` no boot offline não aparece no URL final: a tela de login rebate para o destino assim que a sessão resolve | testar a **ordem** da decisão (`src/stores/__tests__/guarda.test.ts`), não o destino |
| **`cicloAtual` resolve por "último a chegar", não por timestamp.** Verificado: um device offline gravou 9, o servidor recebeu 7 depois, e ao drenar o 9 venceu — um aparelho esquecido offline pode rebobinar o ciclo e invalidar cargas em progresso | `avancarCiclo()` da Fase 5 **precisa** ser `transaction()` no RTDB exigindo online (ARQUITETURA §5). `gravarConfig` genérico não serve para esse campo |
| Um snapshot antigo do servidor chegando durante o boot apaga série recém-registrada | os listeners só aplicam com o outbox vazio (`localEstaAdiantado` em `firebase/sync.ts`). Enquanto houver escrita por subir, o local manda |
| **`ref()` do Vue devolve Proxy, e `structuredClone` rejeita Proxy.** Gravar no IndexedDB um objeto vindo de store estoura `DataCloneError` na primeira escrita, em produção | `planificar()` em `db/idb.ts` converte para dado puro antes do `put`; aplicado também no payload do outbox |
| Releitura disparada por evento é assíncrona e pode aplicar valor velho por cima de escrita mais nova. Comparar `atualizadoEm` não resolve: duas mudanças seguidas caem no mesmo milissegundo | contador de sequência local em `stores/config.ts`; a releitura desiste se houve escrita durante o voo |
| Importar `firebase_*.js` sem o `?v=` do Vite no console cria **segunda instância** do SDK; misturar as duas dá `permission_denied` ou estouro de pilha | ao depurar no browser, importe pelos módulos do app (`/src/firebase/…`), não pelo dep otimizado |
| **`computed` sobre `Date.now()` fica cacheado para sempre** — o tempo não é dependência reativa, e o valor nunca mais muda | `pareceAbandonada()` é função, não `computed`. Vale para qualquer coisa que dependa só do relógio |
| `meta.descanso` traz dois regimes num texto só (`"2-3 min nos compostos · 60-90s nos isoladores"`). Usar o maior dá 3 min de espera no aquecimento de manguito | `descansoDoSlot()` separa por `slot.ancora`, que por DD-03 marca os compostos pesados. É só o valor inicial — o timer tem "+30s" e "Pular" |
| Reiniciar o emulador de Auth apaga as contas; o SDK rejeita o refresh token e desloga | esperado, não é bug do app. Ao testar sync com reinício de emulador, refaça o login |
| **Sem `/metodologia/{versao}` semeada, o app não sincroniza para ninguém.** A regra valida `config.metodologiaVersao` contra `root.child('metodologia')`, então a primeira escrita de config de um usuário novo é recusada com `PERMISSION_DENIED`; como a fila para na primeira travada, nada mais sobe. Observado em produção: `/usuarios` ficou `null` | rodar `npm run seed` **antes** do primeiro login em qualquer ambiente. A tela de Ajustes mostra path e erro das travadas |
| `beforeinstallprompt` dispara logo após o manifest ser processado, muito antes de qualquer tela lazy | a captura é efeito de import de `composables/useInstalacao.ts`, carregado por `main.ts` no boot. Registrar o listener dentro do componente perde o evento |
| IndexedDB evictado no iOS Safari após ~7 dias sem uso | `navigator.storage.persist()` + sugerir instalar como PWA |
| `<input type="number">` é hostil em mobile | `StepperNumero` com botões ≥44px e `inputmode="decimal"` |
| Confiar em `validar()` para checar cooldown | `validar()` vê um ciclo só; use `validarSequencia()` · DD-A17 |
| Corrigir o gerador pós-lançamento troca exercícios de quem está no meio do ciclo | `config.geradorVersao` + bloqueio mid-ciclo · DD-A17 |
| `slot.reps` pode ser textual (`"6-10 / falha"`, `"Até a falha"`) e `slot.series` pode ser intervalo (`"3-4"`) | parsear defensivamente; `null` significa "sem progressão automática", não exceção |
| **Achar que o service worker resolve o offline de dados** | SW cacheia o shell; dados de usuário são IndexedDB. As duas camadas são obrigatórias · DD-A14 |
| Manifest só com SVG quebra instalabilidade no iOS | PNG 192/512 + maskable separado + `apple-touch-icon` 180 · DD-A15 |
| `purpose: "any maskable"` no mesmo ícone corta a arte no Android | entradas separadas para `any` e `maskable` |
| Scaffold do Vite sobrescreve o markdown em `src/` | mover `src/days/**` para `historico/` **antes** · DD-A16 |
| `firebase.json` aponta para `.vitepress/dist` e não tem rewrite de SPA | atualizar na Fase 0 · ARQUITETURA §13 |
| iOS não dispara `beforeinstallprompt` | instrução manual na `Config`: Compartilhar → Adicionar à Tela de Início |
| Barra de gestos do iPhone cobre os botões de registrar série | `viewport-fit=cover` + `env(safe-area-inset-bottom)` |

---

## Estado da implementação

**As sete fases estão concluídas.** O app está em produção no projeto
`fichatreinos`, com `/metodologia/v1` semeada, regras publicadas e instalado no
celular do autor. Daqui em diante o trabalho é incremental — mas as invariantes
acima e as armadilhas abaixo continuam valendo, e cada uma delas custou análise.

Sobrou uma dívida conhecida, registrada e não urgente: `scripts/importar-historico.ts`
(DD-A16) ainda não existe. `historico/2025-4/` e `historico/atual/` estão
preservados no repo como pré-histórico não numerado, fora da numeração de ciclos.


Fases e checkpoints completos em `docs/ARQUITETURA-APP-V1.md` §10. **Não avance sem
o checkpoint.** Atualize esta tabela ao concluir cada fase.

- [x] **Fase 0 — Migração do VitePress.** Branch `migracao-app`. Mover `src/days/**`
      para `historico/` **antes** do scaffold. Deletar `.vitepress/`. Scaffold Vite+Vue.
      Atualizar `firebase.json` (public `dist`, rewrites SPA, headers) e `.gitignore`.
      *Checkpoint:* build gera `dist/`; emulador serve o app; nenhum markdown perdido.
      *Feito:* rota profunda devolve 200 pelo rewrite; `Cache-Control` conferido;
      10 markdowns saíram como rename puro. Emulador de hosting na **5010** — a 5000
      é do AirPlay no macOS.
- [x] **Fase 1 — Fundação.** Scaffold Vite+Vue+Pinia+Router; `src/core/` portado com
      testes; `firebase.json` com headers de DD-A11.
      *Checkpoint:* testes do core verdes **incluindo `validarSequencia(12)` limpo**
      (DD-A17), build gera bundle.
      *Feito:* 31 testes verdes; TypeScript fixado em 5.x (o 7 não expõe `lib/tsc` e
      quebra o `vue-tsc`).
- [x] **Fase 2 — IndexedDB e outbox.** `db/esquema.ts`, `idb.ts`, `outbox.ts`,
      `repos.ts`. Sem Firebase ainda.
      *Checkpoint:* sessão sobrevive a reload; outbox acumula e persiste.
      *Feito:* 40 testes Vitest com `fake-indexeddb`, mais verificação no Chrome
      com IndexedDB real e reload de verdade. Dev server em porta fixa **5199** —
      ver armadilha do service worker vizinho.
- [x] **Fase 3 — Auth e seed.** `firebase/app.ts`, `auth.ts`, `stores/auth.ts`,
      `scripts/seed-metodologia.ts`, `database.rules.json` publicado.
      *Checkpoint:* login Google ok; `/metodologia/v1` populado; reload offline
      mantém sessão; regras negam leitura de outro uid.
      *Feito:* regras publicadas em produção e cobertas por 12 testes contra o
      emulador; sessão sobrevive a reload com o backend de auth **inalcançável**;
      guard coberto por teste de ordem; login Google real confirmado em produção.
      `/metodologia/v1` semeada em produção — `--conferir` reporta 12 ciclos
      idênticos ao bundle, e a config do usuário gravou com timestamp do servidor.
- [x] **Fase 4 — Sync.** `firebase/sync.ts`, `conexao.ts`, `stores/sync.ts`.
      *Feito:* offline com 8 operações enfileiradas, servidor confirmado vazio
      pelo Admin SDK, drenagem em ordem causal até zero em 203ms; descida
      (listener → IndexedDB) validada com escrita de "outro dispositivo";
      `serverTimestamp()` resolvido no servidor e marcador sem vazar.
      *Checkpoint (o mais importante do projeto):* com DevTools offline, registrar
      dados; voltar online e ver o outbox drenar **em ordem**; `pendentes` chega a
      zero. Se isso não estiver sólido, a Fase 6 vai parecer funcionar e não vai.
- [x] **Fase 5 — Ciclo.** `stores/metodologia.ts`, `stores/ciclo.ts`, views `Home` e
      `Ciclo`.
      *Checkpoint:* ciclo exibido idêntico à saída do CLI; avançar ciclo rotaciona
      acessórios e mantém âncoras; volume bate com `volumeSemanal()`.
      *Feito:* Ciclos 1 e 2 renderizados batem por hash com o JSON do CLI (40 itens,
      mesmos nomes, séries, reps e âncoras); avanço manteve as 7 âncoras e rotacionou
      33/33 acessórios; volume idêntico. `avancarCiclo` é `transaction` e recusa
      avanço a partir de valor desatualizado.
      *Decidido (DD-A16):* a ficha atual é o **Ciclo 1**; `historico/2025-4/` é
      pré-histórico não numerado. Core intacto.
- [x] **Fase 6 — Execução.** `core/progressao.ts`, `stores/sessao.ts`,
      `stores/cargas.ts`, view `Treino` e componentes. Fase mais longa.
      *Checkpoint:* treino completo registrável em modo avião, sem perder dado ao
      recarregar no meio.
      *Feito:* com os emuladores derrubados, T1 inteiro registrado (26/26 séries em
      8 exercícios); reload no meio preservou as 13 séries e as 27 operações da fila
      e retomou no exercício certo; ao religar, 54 operações drenaram e o servidor
      recebeu tudo; na segunda execução a tela mostra `+2,5 da última (bateu o topo
      da faixa)` com 62,5 kg preenchido.
- [x] **Fase 7 — PWA, ícones e polimento.** `vite-plugin-pwa`, manifest, pipeline
      de ícones, wake lock, `Historico`, `Config`, export.
      *Checkpoint:* Lighthouse PWA installable = 100; instalar no Android e no iOS e
      conferir o ícone na home screen; com o app instalado e o celular em modo avião,
      abrir e ver o treino atual — valida as duas camadas de DD-A14 de uma vez.
      *Feito:* SW ativo com 31 recursos precacheados; **com o servidor de origem
      derrubado**, o app abriu e renderizou o Ciclo 1 completo — as duas camadas de
      DD-A14 de uma vez. Manifest, os 4 PNG do manifest e o apple-touch-icon
      servidos em 200.
      Instalação no celular confirmada pelo autor do projeto.

---

## `src/core/` — já implementado

Vem pronto em `src-core/` no pacote de referência. Copie para `src/core/` sem
alterar. É código testado: 127 exercícios, 40 slots, 12 ciclos simulados sem
relaxamento de restrição, round-trip RTDB determinístico.

| Arquivo | Responsabilidade |
|---|---|
| `exercicios.ts` | Catálogo `id → { nome, familia, resistencia }` |
| `estrutura.ts` | Slots invariantes (séries, reps, âncora, pool, vínculos) + Ciclo 1 fixado |
| `metodologia.ts` | Composição versionada + `paraRtdb()` / `deRtdb()` |
| `gerador.ts` | `criarGerador(metodologia, opts)` — resolução de restrições, validadores, volume |
| `render.ts` | Saída markdown/JSON (usada no export de dados) |
| `progressao.ts` | **A implementar na Fase 6.** Contrato em `docs/ARQUITETURA-APP-V1.md` §9 |

API:

```ts
const g = criarGerador(METODOLOGIA_V1, { indisponiveis, ciclosFixos });
g.gerarCiclo(2);        // Ciclo completo, determinístico
g.volumeSemanal();      // { peito: 17, costas: 20, ... }
g.validarCatalogo();    // erros de integridade do catálogo
g.validar(porSlot);     // violações de DD-05/DD-06 num ciclo isolado
g.validarSequencia(12); // violações de DD-03/DD-04 ENTRE ciclos
```

`validar()` recebe o mapeamento de um único ciclo e é estruturalmente cego a
cooldown, que é propriedade entre ciclos — foi essa cegueira que deixou um
off-by-one em `gerarCiclo` produzir 93 repetições N→N+1 sem um único aviso. Use
`validarSequencia()` na suíte, não só `validar()` (DD-A17).

O Ciclo 1 é a ficha real fixada (DD-11), não escolha do gerador: ele colide em
DD-06 nos slots `T4-S2`, `T4-S5`, `T4-S7` e `T5-S4`. É o problema que a rotação
existe para resolver, e por isso o CLI suprime os avisos do ciclo fixado. Do
Ciclo 2 em diante, `validar()` sai vazio.

`g.validarSequencia(12)` valida DD-03 e DD-04 **entre** ciclos e precisa estar na
suíte de testes da Fase 1. `validar()` recebe um único ciclo e é estruturalmente cego
a cooldown — foi essa cegueira que deixou um off-by-one produzir 93 violações de
DD-04 sem um único aviso. Não confie só em `validar()`.

`ferramentas/cli.ts` inspeciona ciclos fora do app. **Não incluir no bundle.**

```bash
node --experimental-strip-types ferramentas/cli.ts 2          # Ciclo 2 em Markdown
node --experimental-strip-types ferramentas/cli.ts 2 --json   # JSON
node --experimental-strip-types ferramentas/cli.ts --check    # valida + simula 12 ciclos
node --experimental-strip-types ferramentas/cli.ts --diff 2 3 # o que muda entre ciclos
```

Use `--diff` e `--check` como referência ao validar o checkpoint da Fase 5: a UI
tem que mostrar exatamente o que o CLI mostra.

---

## Convenções

- Vue 3 `<script setup>` com TypeScript. Sem Options API.
- Composables em `src/composables/`, prefixo `use`.
- Nomes de arquivo: `PascalCase.vue` para componentes, `camelCase.ts` para o resto.
- Sem biblioteca de UI. CSS próprio, mobile-first. Alvo de toque mínimo 44×44px.
- Sem dependência nova sem justificativa — `core/` tem zero dependências e deve
  continuar assim.
- Testes: `node --test` para `core/`, Vitest para stores e componentes.
- Commits em pt-BR, imperativo: `adiciona outbox de sincronização`.

## PWA — o essencial

Detalhes completos em `docs/ARQUITETURA-APP-V1.md` §14.

- **Duas camadas independentes, ambas obrigatórias.** Service worker faz o app
  *carregar* offline. IndexedDB faz os *dados* estarem disponíveis. O SW não
  intercepta o WebSocket do RTDB — não existe cachear RTDB via `fetch` handler.
- Ícones: SVG é a fonte, PNG vai no manifest. Duas artes SVG separadas — a maskable
  precisa de safe zone de 80%, não é a mesma arte reescalada.
- iOS ignora o manifest: precisa de `<link rel="apple-touch-icon">` com PNG 180×180
  sem alfa.
- `viewport-fit=cover` + `env(safe-area-inset-bottom)`, ou os botões de registrar
  série ficam sob a barra de gestos do iPhone.

## Contexto de uso real

O app é usado com celular na mão, na academia, entre séries, possivelmente com uma
mão só e mão suada. Isso não é detalhe de polimento — é restrição de design que vale
mais que densidade de informação na tela. Botão grande, contraste alto, desfazer
sempre acessível (erro de digitação é o evento mais comum), e commit local sem
spinner ao registrar série.
