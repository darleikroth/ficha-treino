# FichaTreino — Arquitetura do App v1

Refatoração do site estático `fichatreinos.web.app` em app de controle de treino.
Documento de handoff para implementação via Claude Code.

**Stack:** Vite + Vue 3 (Composition API) + Pinia + Vue Router · Firebase (Auth,
Realtime Database, Hosting) · IndexedDB · PWA

**Depende de:** `SISTEMA-ROTACAO-V1.md` (metodologia, DD-01 a DD-11) e do módulo
`gerador-treinos` (motor determinístico, já implementado e testado).

Os DDs deste documento usam prefixo `DD-A` para não colidir com os DDs de
metodologia, referenciados aqui como `DD-xx`.

---

## 1. O problema central: RTDB não persiste em disco no browser

**O Web SDK do Realtime Database não tem persistência offline.**
`setPersistenceEnabled` existe apenas nos SDKs Android e iOS. No browser o cache do
RTDB é em memória e é perdido no reload da página.

Consequência direta: `offline-first` com RTDB no browser não é configuração, é
código. Duas saídas:

| Opção | Prós | Contras |
|---|---|---|
| Trocar para Firestore | `persistentLocalCache` resolve offline nativamente | Modelo de query diferente, custo por operação, migração maior |
| **RTDB + IndexedDB próprio** | Controle total, dataset offline é pequeno e bem delimitado, RTDB é mais barato para escrita frequente | Camada de sync manual (outbox) |

**Escolha: RTDB + IndexedDB próprio.** Justificativa em DD-A02. O fator decisivo é
que o dado que precisa estar offline é minúsculo, e a escrita durante o treino é
frequente e pequena (uma série por vez) — perfil em que o RTDB é mais eficiente
que o Firestore.

### O que torna isso viável: o gerador é determinístico

`gerarCiclo(n)` é função pura de `(metodologia, n)`. O treino de hoje **não é um
dado armazenado** — é computado no cliente a partir de três coisas: a metodologia,
o número do ciclo e os overrides. Isso significa que o único estado que precisa
sincronizar é pequeno:

- `config` — um objeto
- `overrides` — raramente preenchido
- `cargas` — um número por exercício (~127 no máximo)
- `sessoes` — o log do que foi executado

Não há necessidade de armazenar ciclos gerados, nem de baixar "o treino" do
servidor. Isso é o que faz o offline ser tratável.

---

## 2. Decisões de Design

### DD-A01 — `core/` é framework-agnóstico e não conhece Firebase nem Vue
O módulo `gerador-treinos` entra em `src/core/` sem alteração. Nenhum arquivo em
`core/` importa Vue, Pinia ou Firebase. Ele é testável com `node --test` puro e é a
única parte do sistema com lógica de metodologia. Stores Pinia são *wrappers* finos
sobre ele. Se essa regra for violada, a suíte de testes do core deixa de rodar sem
mock e a metodologia fica impossível de validar isoladamente.

### DD-A02 — RTDB é fonte de verdade; IndexedDB é espelho local; escritas passam por outbox
Fluxo de escrita, sem exceção:

```
UI → IndexedDB (commit local, síncrono do ponto de vista da UI) → outbox → RTDB
```

Fluxo de leitura: **a UI lê exclusivamente do IndexedDB.** Nunca de um listener
RTDB direto. Listeners RTDB escrevem no IndexedDB, e a UI reage ao IndexedDB. Isso
elimina toda a classe de bugs "funciona online, quebra offline", porque o caminho de
leitura é idêntico nos dois casos.

### DD-A03 — Metodologia é versionada e pinada por usuário
`/metodologia/{versao}` é read-only para clientes, escrita só por script de seed.
`config.metodologiaVersao` pina a versão do usuário. Trocar de versão é ação
explícita e **bloqueada no meio de um ciclo** — mudar pools com um ciclo em
andamento faria `gerarCiclo(n)` devolver outros exercícios e invalidaria as cargas
em progresso.

### DD-A04 — O catálogo é injetado no gerador
Já implementado: `criarGerador(metodologia, opts)`. A metodologia vem do IndexedDB
(que veio do RTDB) ou do bundle embutido no primeiro carregamento. `paraRtdb()` e
`deRtdb()` fazem a serialização — e `deRtdb()` **reordena os slots**, porque o RTDB
não garante ordem de chaves e a ordem dos slots é semanticamente relevante (DD-06
exige que T1..T3 sejam resolvidos antes de T4/T5). Round-trip validado em 12 ciclos.

### DD-A05 — Sessões guardam o nome literal do exercício
Cada série registrada armazena `exercicioId` **e** `exercicioNome`, além de
`metodologiaVersao`. O histórico fica desacoplado da metodologia: você pode
descartar `v1` do RTDB sem corromper sessões antigas, e um gráfico de progressão de
"Supino Reto com Barra" continua legível mesmo se o id sair do catálogo.

### DD-A06 — Overrides manuais por ciclo
`/usuarios/{uid}/overrides/{ciclo}/{slotId} = exercicioId`. Já suportado via
`ciclosFixos` no gerador. Caso de uso real: máquina quebrada, academia lotada. O
override entra na cadeia de cooldown, então o ciclo seguinte respeita a escolha
manual. Distinto de `config.indisponiveis`, que é filtro permanente de equipamento.

### DD-A07 — Uma sessão ativa por vez, com id gerado no cliente
`sessaoId = ${Date.now()}-${random4}`. Ordena cronologicamente por chave (útil no
RTDB, que não tem query decente) e nunca colide entre dispositivos. Se existir
sessão ativa não finalizada há mais de 6h, o app oferece descartar ou retomar — sem
isso o usuário fica preso numa sessão fantasma de um treino abandonado.

### DD-A08 — A semana do ciclo deriva de sessões concluídas, não de data
`semanaAtual = min(floor(sessoesConcluidas / 5) + 1, semanasPorCiclo)`, com override
manual. Datas quebram na primeira semana em que se treina 3 vezes em vez de 5 — e
como a progressão de RIR (DD-10) depende da semana, derivar de data faria o app
mandar treinar em RIR 1 alguém que está na terceira sessão do ciclo.

### DD-A09 — Sugestão de carga é derivada, nunca gravada
Ao abrir um exercício, o app sugere carga a partir de `cargas/{exercicioId}` e da
regra de DD-10: se na última execução todas as séries atingiram o topo da faixa de
reps, sugere `+incremento`; senão repete a carga. A sugestão é sempre editável e
nunca é persistida como se fosse dado registrado. Módulo: `core/progressao.ts`.

### DD-A10 — `cargas` é denormalizado de propósito
`/usuarios/{uid}/cargas/{exercicioId}` duplica informação que já está nas sessões.
Justificativa: abrir um treino exige a última carga de ~8 exercícios
instantaneamente e offline. Derivar isso varrendo sessões seria lento e exigiria ter
o histórico completo local. Escrita dupla (sessão + cargas) no mesmo commit do
outbox.

### DD-A11 — PWA com atualização controlada, service worker fora do cache
`vite-plugin-pwa`. No `firebase.json`, `sw.js` e `index.html` recebem
`Cache-Control: no-cache`; assets com hash recebem `max-age=31536000, immutable`.
Sem isso o usuário fica preso numa versão antiga indefinidamente — o Firebase
Hosting tem cache agressivo por padrão.

> **Revisão 2026-08-01 — `prompt` no lugar de `autoUpdate`.** Com `autoUpdate` o
> service worker assume e **recarrega a página sozinho** ao detectar versão
> nova. Este app fica aberto durante o treino: o reload cairia no meio de uma
> série. O dado sobrevive, porque está no IndexedDB, mas o timer de descanso
> zera e o card aberto se perde. Passou a `registerType: 'prompt'` — o SW novo
> fica em `waiting` e um banner deixa o usuário escolher a hora. O objetivo
> original está mantido: ninguém fica preso numa versão antiga, e a checagem é
> periódica e ao voltar do segundo plano, não só em navegação.
>
> **Correção 2026-08-01 — `source` casa o caminho da requisição.** O header
> `no-cache` estava declarado só para `/index.html`, mas o Hosting compara
> `source` com o caminho pedido, não com o arquivo que o rewrite resolve.
> Medido em produção: `/index.html` vinha `no-cache` e `/` e `/ciclo` vinham
> `max-age=3600` — exatamente as URLs que se abre. Corrigido com `source: "/"`
> e `source: "**/!(*.*)"` (segmento final sem ponto = navegação).

### DD-A12 — Login com popup, não redirect
`signInWithPopup`. `signInWithRedirect` depende de cookies de terceiros e está
quebrado em Safari e em Chrome com bloqueio de cookies. Como o `authDomain` é o
próprio `fichatreinos.web.app`, o popup é same-origin e funciona. O boot do app
**não pode bloquear em chamada de rede de auth**: `onAuthStateChanged` resolve a
partir da persistência local (o Firebase Auth já persiste em IndexedDB), então
abrir offline mantém a sessão.

### DD-A17 — `geradorVersao` é pinado junto com `metodologiaVersao`
`metodologiaVersao` versiona os **dados** da metodologia (pools, slots, séries,
reps). Não cobre mudanças no **código** do gerador, e a distinção deixou de ser
teórica: um off-by-one no cooldown de DD-04 foi corrigido em 2026-08-01, alterando a
saída de todos os ciclos ≥ 3 sem que a metodologia mudasse uma linha.

Antes do lançamento isso é gratuito — não existe usuário com ciclo em andamento.
Depois, não é: uma correção no gerador trocaria os exercícios de alguém no meio da
semana 4.

Portanto: `config.geradorVersao` gravado junto de `metodologiaVersao`, e mudança de
gerador que altere saída recebe o mesmo tratamento de DD-A03 — **bloqueada no meio de
um ciclo**, aplicada na virada. Sessões já estão protegidas por DD-A05 (guardam o
nome literal do exercício), então o histórico nunca é afetado; o risco é só o ciclo
corrente.

Corolário para os testes: `validarSequencia(12)` entra na suíte da Fase 1. Ele valida
DD-03 e DD-04 **entre** ciclos, que é onde `validar()` é cego — foi essa cegueira que
deixou 93 violações passarem sem um único aviso.

### DD-A13 — Ruptura limpa com o VitePress, não migração incremental
O repo hoje é um site VitePress: `src/` contém markdown de conteúdo e `.vitepress/`
contém tema e config. VitePress é Vite + Vue por baixo, mas é um SSG com router e
tema próprios — não existe caminho incremental para virar SPA sem herdar
complexidade inútil.

Ação: scaffold novo de Vite + Vue na raiz, `.vitepress/` deletado, markdown atual
movido para `historico/` como dado de importação (DD-A16). `src/` passa a ser
código-fonte do app. **Isso é destrutivo sobre o `src/` atual** — faça em branch, e
mova o markdown antes de scaffoldar.

### DD-A14 — Service worker garante o app; IndexedDB garante os dados
Distinção que precisa ficar explícita porque é a fonte mais comum de PWA "offline"
que não funciona offline:

| Camada | Garante | Não garante |
|---|---|---|
| Service worker (Workbox) | Que o app **carregue** sem rede: HTML, JS, CSS, fontes, ícones | Qualquer dado de usuário |
| IndexedDB + outbox (DD-A02) | Que o **treino e as cargas** estejam disponíveis e graváveis sem rede | Que o app abra |

O SW não intercepta o WebSocket do RTDB — não há como cachear a conexão do
Realtime Database via `fetch` handler. As duas camadas são independentes e ambas são
obrigatórias. Um app com SW perfeito e sem IndexedDB abre offline e mostra tela
vazia.

Estratégia de cache: `precache` do shell (`registerType: 'prompt'`, ver DD-A11), sem
runtime caching para RTDB. Se houver runtime caching, restrinja a fontes e avatares
do Google (`CacheFirst`, expiração de 30 dias).

### DD-A15 — Ícones: SVG como fonte, PNG no build
SVG é a fonte de verdade dos ícones, mas **o manifest precisa de PNG**. Chrome
aceita SVG no manifest; iOS não, e `purpose: "maskable"` na prática exige raster.
Publicar só SVG quebra a instalabilidade no iOS silenciosamente.

Pipeline: artwork em `assets/icones/*.svg` → `scripts/gerar-icones.ts` rasteriza no
build → `public/icones/*.png`. Requisitos completos em §14.

### DD-A16 — Ciclos históricos em markdown são importados, não descartados
`src/days/2025-4/treino-{1..5}.md` é um ciclo arquivado, e `src/days/treino-{1..5}.md`
é o ciclo corrente. Esses arquivos são o histórico real de treino e devem ser
preservados.

Tratamento: mover para `historico/` no repo (versionado, fora do build), e escrever
`scripts/importar-historico.ts` que parseia as tabelas markdown e semeia
`/usuarios/{uid}/overrides/{ciclo}` para os ciclos passados. Não tente derivar
sessões executadas desses arquivos — eles registram o *plano*, não o que foi feito,
e inventar sessões falsas contaminaria a base de cargas (DD-A10).

**Questão aberta:** a numeração de ciclos precisa ser reconciliada. `CICLO_1_FIXO`
no core assume que a ficha atual é o Ciclo 1, mas a existência de `2025-4` indica
ciclos anteriores. Decida antes da Fase 5: ou renumera (`2025-4` vira Ciclo 1, a
ficha atual vira Ciclo 2) ou mantém a ficha atual como Ciclo 1 e trata `2025-4`
como pré-histórico não numerado. A primeira é mais correta; a segunda é mais
simples e não muda o core.


---

## 3. Modelo de dados RTDB

```
/metodologia/{versao}
  versao: "v1"
  semanasPorCiclo: 9
  exercicios/{exercicioId}         { nome, familia, resistencia }
  slots/{slotId}                   { id, treino, alvo, funcao, series, reps,
                                     ancora, opcional?, preferResistencia?,
                                     familiaDistintaDe?, volume, pool }
  treinos/{treinoId}               { id, dia, titulo, objetivo, descanso }
  ciclo1/{slotId}: exercicioId
  progressao/{i}                   { semanas, rir, nota }

/usuarios/{uid}
  perfil                           { nome, email, foto, criadoEm }
  config
    metodologiaVersao: "v1"
    cicloAtual: 2
    semanaManual: null             # override de DD-A08
    incrementoPadrao: 2.5          # kg
    unidade: "kg"
    indisponiveis/{exercicioId}: true
    atualizadoEm: <server ts>
  overrides/{ciclo}/{slotId}: exercicioId
  sessoes/{sessaoId}
    treinoId: "T1"
    ciclo: 2
    semana: 3
    metodologiaVersao: "v1"
    status: "ativa" | "concluida" | "descartada"
    inicioEm, fimEm
    series/{slotId}/{indice}       { exercicioId, exercicioNome, peso, reps,
                                     rir, concluidaEm }
  cargas/{exercicioId}             { peso, reps, bateuTopo, atualizadoEm, sessaoId }
  prs/{exercicioId}                { peso, reps, e1rm, data, sessaoId }
```

Notas de modelagem RTDB:

- **Arrays não existem.** Slots, treinos e progressão viram mapas indexados. Séries
  usam índice numérico como chave string.
- **`series` aninhado por `slotId` e depois por índice** permite escrever uma série
  isolada com `update()` no path exato, sem read-modify-write. Isso importa: durante
  o treino cada série é uma escrita, e read-modify-write com conexão instável perde
  dados.
- **Paths rasos na leitura.** `sessoes` cresce sem limite; nunca leia o nó inteiro.
  Sincronize apenas as N mais recentes via
  `query(ref, orderByKey(), limitToLast(30))` — funciona porque `sessaoId` começa
  com timestamp.

### Regras de segurança (`database.rules.json`)

```json
{
  "rules": {
    "metodologia": {
      ".read": "auth != null",
      ".write": false
    },
    "usuarios": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "config": {
          "cicloAtual": { ".validate": "newData.isNumber() && newData.val() >= 1" },
          "metodologiaVersao": { ".validate": "root.child('metodologia').child(newData.val()).exists()" }
        },
        "sessoes": {
          "$sessaoId": {
            "status": { ".validate": "newData.val() === 'ativa' || newData.val() === 'concluida' || newData.val() === 'descartada'" },
            "series": {
              "$slotId": {
                "$indice": {
                  "peso": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() < 1000" },
                  "reps": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() < 200" },
                  "rir": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

O `.validate` em `metodologiaVersao` impede pinar uma versão inexistente — falha de
sync silenciosa que seria difícil de diagnosticar depois.

---

## 4. Camadas e árvore de arquivos

```
src/
  core/                      # DD-A01 · zero dependências de Vue/Firebase
    exercicios.ts            # catálogo (fallback embutido)
    estrutura.ts             # slots invariantes + ciclo1
    metodologia.ts           # composição versionada + paraRtdb/deRtdb
    gerador.ts               # criarGerador(metodologia, opts)
    progressao.ts            # NOVO · sugestão de carga (DD-A09)
    render.ts                # markdown/json (usado no export)
    __tests__/

  db/                        # IndexedDB
    idb.ts                   # wrapper mínimo sobre IDBDatabase
    esquema.ts               # object stores e migrações
    outbox.ts                # fila de escrita (DD-A02)
    repos.ts                 # repositórios por entidade

  firebase/
    app.ts                   # initializeApp, getAuth, getDatabase
    auth.ts                  # signInWithPopup, onAuthStateChanged
    paths.ts                 # construtores de path tipados
    sync.ts                  # drenagem do outbox + listeners → IndexedDB
    conexao.ts               # observador de .info/connected

  stores/                    # Pinia
    auth.ts  metodologia.ts  ciclo.ts  sessao.ts  cargas.ts  sync.ts

  views/
    Login.vue  Home.vue  Treino.vue  Ciclo.vue  Historico.vue  Config.vue

  components/
    ExercicioCard.vue  SerieInput.vue  StepperNumero.vue
    TimerDescanso.vue  IndicadorSync.vue  ProgressoCiclo.vue

  composables/
    useWakeLock.ts  useTimer.ts

  router/index.ts
  main.ts

assets/icones/
  icone.svg                  # arte-fonte (purpose: any)
  icone-maskable.svg         # arte-fonte com safe zone de 80% · DD-A15

public/icones/               # PNG gerado no prebuild · NÃO versionar
  icone-192.png  icone-512.png
  icone-maskable-192.png  icone-maskable-512.png
  apple-touch-icon-180.png

historico/                   # markdown do VitePress preservado · DD-A16
  2025-4/treino-1..5.md
  atual/treino-1..5.md

scripts/
  seed-metodologia.ts        # semeia /metodologia/v1 (Admin SDK)
  importar-historico.ts      # parseia historico/ → overrides · DD-A16
  gerar-icones.ts            # SVG → PNG · DD-A15
database.rules.json
firebase.json
vite.config.ts
```

Regra de dependência, de dentro para fora:
`core` ← `db` ← `firebase/sync` ← `stores` ← `views`.
`core` não importa nada das camadas externas. `views` nunca importa `firebase` nem
`db` diretamente — só stores.

---

## 5. Offline-first

### IndexedDB (`fichatreino`, versão 1)

| Store | Chave | Conteúdo |
|---|---|---|
| `meta` | string | `metodologiaVersao`, `ultimoSyncEm`, `uidAtivo` |
| `metodologia` | `versao` | objeto Metodologia completo |
| `config` | `uid` | config do usuário |
| `sessoes` | `sessaoId` | sessão completa · índice `porStatus`, `porCiclo` |
| `cargas` | `${uid}:${exercicioId}` | `{ peso, reps, bateuTopo, atualizadoEm }` |
| `overrides` | `${uid}:${ciclo}` | mapa slotId → exercicioId |
| `outbox` | autoIncrement | `{ path, op, payload, criadoEm, tentativas }` |

### Outbox

```ts
type OpOutbox = {
  id?: number;
  path: string;                    // path RTDB absoluto
  op: "set" | "update" | "remove";
  payload: unknown;
  criadoEm: number;
  tentativas: number;
};
```

Drenagem:

1. Dispara quando `.info/connected` vira `true`, no boot, e após cada escrita local
   se já estiver online.
2. Processa **em ordem de inserção**, sequencialmente. Paralelizar quebra a
   causalidade entre "criar sessão" e "adicionar série a ela".
3. Sucesso → remove do outbox. Falha → `tentativas++`, backoff exponencial
   (1s, 2s, 4s… teto 60s). Acima de 8 tentativas, marca como `travada` e expõe no
   `IndicadorSync` — falha permanente costuma ser regra de segurança, e retry
   infinito só esconde o bug.
4. `serverTimestamp()` nos campos `atualizadoEm` para que o LWW use o relógio do
   servidor, não o do dispositivo.

### Resolução de conflito

Cenário real: mesmo usuário no celular na academia e no desktop em casa.

- **`cargas`** — LWW por `atualizadoEm` do servidor. Aceitável: perder uma
  atualização de carga é irrelevante.
- **`sessoes`** — chaves geradas no cliente nunca colidem. Séries são keyed por
  `slotId/indice`; duas escritas no mesmo índice são LWW.
- **`config.cicloAtual`** — este importa. Avançar de ciclo em dois dispositivos
  causaria divergência de treino. Mitigação: avanço de ciclo requer estar online, e
  a operação é `transaction()` no RTDB verificando o valor anterior.

### Ciclos de vida a tratar

- **Boot offline sem cache** (primeiro acesso sem rede): usa `METODOLOGIA_V1`
  embutida no bundle, entra em modo leitura, bloqueia registro de série até haver
  `uid` conhecido.
- **iOS Safari evicta IndexedDB após ~7 dias sem uso.** Para uso 5x/semana é
  irrelevante, mas chame `navigator.storage.persist()` e sugira instalar como PWA —
  storage de PWA instalado tem garantia melhor.
- **Aba duplicada:** IndexedDB é compartilhado; use `BroadcastChannel` para invalidar
  stores em outras abas depois de escrever.

---

## 6. Stores Pinia — contratos

```ts
// stores/auth.ts
{ user: Ref<User|null>, carregando: Ref<boolean>,
  entrar(): Promise<void>, sair(): Promise<void> }

// stores/metodologia.ts
{ metodologia: Ref<Metodologia|null>,
  gerador: ComputedRef<Gerador|null>,   // criarGerador(metodologia, { indisponiveis, ciclosFixos })
  carregar(versao: string): Promise<void> }

// stores/ciclo.ts
{ cicloAtual: Ref<number>,
  semanaAtual: ComputedRef<number>,      // DD-A08
  faseProgressao: ComputedRef<FaseProgressao>,
  ciclo: ComputedRef<Ciclo|null>,        // gerador.gerarCiclo(cicloAtual)
  treino(id: TreinoId): ComputedRef<TreinoGerado>,
  avancarCiclo(): Promise<void>,         // transaction, requer online
  definirOverride(ciclo, slotId, exercicioId): Promise<void> }

// stores/sessao.ts
{ ativa: Ref<Sessao|null>,
  iniciar(treinoId: TreinoId): Promise<void>,
  registrarSerie(slotId, indice, dados): Promise<void>,
  desfazerSerie(slotId, indice): Promise<void>,
  finalizar(): Promise<void>,
  descartar(): Promise<void>,
  progresso: ComputedRef<{ feitas: number; total: number }> }

// stores/cargas.ts
{ mapa: Ref<Record<string, Carga>>,
  sugestao(exercicioId, slot): ComputedRef<{ peso: number; motivo: string }> }

// stores/sync.ts
{ online: Ref<boolean>, pendentes: Ref<number>,
  travadas: Ref<OpOutbox[]>, ultimoSyncEm: Ref<number|null>,
  drenar(): Promise<void> }
```

`ciclo` e `treino` sendo `computed` sobre o gerador é o ponto onde o determinismo
paga: nenhum estado derivado precisa ser invalidado ou re-sincronizado.

---

## 7. Rotas e telas

| Rota | Tela | Conteúdo |
|---|---|---|
| `/login` | Login | Botão Google. Redireciona se já autenticado. |
| `/` | Home | Treino sugerido para hoje, progresso do ciclo (semana X de 9, fase de RIR), botão grande "Iniciar treino", estado de sync. |
| `/treino/:treinoId` | Treino | Execução. Detalhada abaixo. |
| `/ciclo` | Ciclo | Os 5 treinos do ciclo atual, tabela de volume semanal, avisos do gerador, ação de avançar ciclo, overrides. |
| `/historico` | Histórico | Sessões concluídas, progressão de carga por exercício. |
| `/config` | Config | Incremento padrão, equipamento indisponível, versão da metodologia, exportar dados. |

Guard: rotas exceto `/login` exigem `auth.user`. O guard espera a resolução de
`onAuthStateChanged` (que vem do storage local) antes de decidir — não redirecione
para `/login` durante o estado `carregando`, ou o app pisca a tela de login a cada
abertura offline.

---

## 8. Tela de execução do treino

É a tela que define se o app é usável. Restrições: celular na mão, mão suada,
possivelmente uma mão só, entre séries, com pressa.

**Layout:** lista vertical de cards, um por exercício, na ordem dos slots. Card
expandido = exercício atual; os demais colapsados mostrando só nome, séries
feitas/alvo e carga.

**Card expandido contém:**
- Nome do exercício, alvo, badge `[Â]` se âncora
- `4 × 8-12` — séries alvo e faixa de reps do slot
- Fase de RIR da semana atual (DD-10), ex. `Semanas 3-5 · RIR 2`
- Séries já registradas, editáveis
- Entrada da próxima série: peso, reps, RIR
- Sugestão de carga com motivo, ex. `40 kg · +2,5 da última (bateu o topo da faixa)`

**Interação:**
- `StepperNumero` com botões `−`/`+` grandes, incremento configurável. **Não use
  `<input type="number">`** — teclado numérico em mobile é hostil e o campo aceita
  lixo. Permita edição direta via tap no valor, com teclado `inputmode="decimal"`.
- Alvo de toque mínimo 44×44px, contraste alto.
- Ao registrar série: commit local imediato (sem spinner, sem esperar rede), inicia
  `TimerDescanso` com o descanso do treino como default.
- `overscroll-behavior: contain` no container para não disparar pull-to-refresh.
- Wake lock ativo durante a sessão (`useWakeLock`), liberado ao finalizar.
- Desfazer última série sempre acessível — erro de digitação é o evento mais comum.

**Timer de descanso:** contagem regressiva, notificação sonora/vibração ao fim,
continua contando se o app for para background (calcule por timestamp, não por
`setInterval` acumulado — `setInterval` é throttled em background e vai atrasar).

---

## 9. `core/progressao.ts` — a implementar

Único módulo novo de lógica. Contrato:

```ts
export interface Carga {
  peso: number; reps: number; bateuTopo: boolean; atualizadoEm: number;
}

export interface Sugestao {
  peso: number;
  motivo: string;
  fonte: "ultima" | "progressao" | "sem-historico";
}

/** DD-10: sobe carga quando o topo da faixa foi atingido em todas as séries. */
export function sugerirCarga(
  slot: Slot, ultima: Carga | undefined, incremento: number,
): Sugestao;

/** Extrai faixa de reps do slot ("8-12" → [8,12]; "6-10 / falha" → [6,10]). */
export function faixaReps(reps: string): [number, number] | null;

/** true se todas as séries registradas atingiram o topo da faixa. */
export function bateuTopo(
  series: { reps: number }[], slot: Slot, seriesAlvo: number,
): boolean;

/** Epley. Só para exibição de PR, nunca para prescrever carga. */
export function e1rm(peso: number, reps: number): number;
```

Cuidado com `slot.series`: alguns são intervalo (`"3-4"`) e `reps` pode conter
texto (`"6-10 / falha"`, `"Até a falha"`). Parseie defensivamente e trate `null`
como "sem progressão automática" em vez de lançar exceção — um slot com reps
textual não deve derrubar a tela de treino.

---

## 10. Ordem de implementação

Sete fases, cada uma com checkpoint verificável. Não avance sem o checkpoint.

**Fase 0 — Migração do VitePress** (DD-A13, DD-A16)
Branch novo. Mover `src/days/**` para `historico/` **antes** de qualquer scaffold.
Deletar `.vitepress/`. Scaffold Vite + Vue em `src/`. Atualizar `firebase.json`
(`public: "dist"`, rewrites de SPA, headers de DD-A11) e `.gitignore`.
*Checkpoint:* `npm run build` gera `dist/`; `firebase emulators:start` serve o app
vazio; nenhum markdown de treino perdido — confira `git log --stat` do commit de
move.

**Fase 1 — Fundação**
Scaffold Vite + Vue + Pinia + Router. Copiar `gerador-treinos/src` para `src/core/`.
Portar os testes. `firebase.json` com headers de DD-A11.
*Checkpoint:* `npm test` verde no core, **incluindo `validarSequencia(12)` sem
problemas** (DD-A17); `npm run build` gera bundle; `--check` do gerador roda como
script.

**Fase 2 — IndexedDB e outbox**
`db/esquema.ts`, `db/idb.ts`, `db/outbox.ts`, `db/repos.ts`. Sem Firebase ainda:
tudo local.
*Checkpoint:* teste que escreve sessão, recarrega a página e a sessão persiste;
outbox acumula operações e sobrevive a reload.

**Fase 3 — Auth e seed**
`firebase/app.ts`, `auth.ts`, `stores/auth.ts`, `scripts/seed-metodologia.ts`,
`database.rules.json` publicado.
*Checkpoint:* login Google funciona; `/metodologia/v1` populado; recarregar offline
mantém sessão autenticada; regras negam leitura de outro uid (teste com o simulador
de regras do console).

**Fase 4 — Sync**
`firebase/sync.ts`, `conexao.ts`, `stores/sync.ts`. Listeners RTDB escrevendo em
IndexedDB; drenagem do outbox com backoff.
*Checkpoint:* com DevTools em offline, registrar dados; voltar online e ver o
outbox drenar em ordem; `pendentes` chega a zero; dado aparece no console do
Firebase.

**Fase 5 — Ciclo**
`stores/metodologia.ts`, `stores/ciclo.ts`, views `Home` e `Ciclo`.
*Checkpoint:* o ciclo exibido é idêntico à saída de
`gerador-treinos --diff`; avançar ciclo rotaciona acessórios e mantém âncoras;
volume semanal exibido bate com `volumeSemanal()`.

**Fase 6 — Execução**
`core/progressao.ts`, `stores/sessao.ts`, `stores/cargas.ts`, view `Treino` e
componentes. Esta é a fase mais longa.
*Checkpoint:* treino completo registrável em modo avião, do início ao fim, sem erro
e sem perder dado ao recarregar no meio; sugestão de carga aparece na segunda
execução do mesmo treino.

**Fase 7 — PWA, ícones e polimento** (DD-A14, DD-A15)
`vite-plugin-pwa`, manifest, pipeline de ícones (§14), wake lock, `Historico`,
`Config`, export de dados.
*Checkpoint:* Lighthouse PWA installable = 100; instalar no Android e no iOS e
confirmar ícone correto na home screen (não o screenshot genérico do Safari); com o
app instalado e o celular em modo avião, abrir e ver o treino atual — este é o teste
que valida DD-A14 nas duas camadas de uma vez.

---

## 11. Riscos e armadilhas

| Risco | Mitigação |
|---|---|
| RTDB web sem persistência (§1) | IndexedDB próprio · DD-A02 |
| Firebase Hosting cacheia `index.html` e `sw.js` | headers explícitos · DD-A11 |
| `signInWithRedirect` quebrado por cookies de terceiros | `signInWithPopup` · DD-A12 |
| Guard de rota piscando login no boot offline | esperar resolução de `onAuthStateChanged` |
| `setInterval` throttled em background atrasa timer | calcular por `Date.now()`, não acumular ticks |
| Ordem de chaves do RTDB embaralha slots | `deRtdb()` reordena · já implementado e testado |
| `sessoes` crescendo sem limite | nunca ler o nó inteiro; `limitToLast(30)` |
| Trocar metodologia no meio de ciclo invalida cargas | bloquear troca com ciclo em andamento · DD-A03 |
| IndexedDB evictado no iOS após 7 dias | `navigator.storage.persist()` + sugerir instalar PWA |
| Drenagem paralela do outbox quebra causalidade | processar sequencialmente, em ordem de inserção |
| Assumir que o service worker resolve o offline de dados | SW cacheia o shell; dados são IndexedDB · DD-A14 |
| Manifest só com SVG quebra instalabilidade no iOS | PNG 192/512 + maskable + `apple-touch-icon` 180 · DD-A15 |
| `firebase.json` aponta para `.vitepress/dist` e falta rewrite de SPA | atualizar na Fase 0 · §13 |
| Scaffold do Vite sobrescrevendo o markdown em `src/` | mover `src/days/**` para `historico/` **antes** · DD-A16 |
| iOS não dispara evento de instalação nem mostra prompt | instrução manual "Compartilhar → Adicionar à Tela de Início" na `Config` |

---

## 12. Nota para o Claude Code

Vale criar um `CLAUDE.md` na raiz do repo apontando para este documento e fixando as
invariantes que são fáceis de violar sem perceber:

- `src/core/` não importa Vue, Pinia nem Firebase (DD-A01)
- A UI lê do IndexedDB, nunca de listener RTDB direto (DD-A02)
- Toda escrita passa pelo outbox (DD-A02)
- Séries gravam `exercicioNome` literal, não só o id (DD-A05)
- `views/` importa apenas `stores/`
- Séries e reps de slot nunca são alterados em runtime (DD-02)

Essas seis regras são o que mantém o offline funcionando e o histórico legível. As
demais decisões são negociáveis.

---

## 13. Migração do VitePress

### Estado atual

```
FICHA-TREINO/
  .firebase/            cache do CLI (gitignore)
  .vitepress/           tema e config do VitePress   → deletar
  src/
    days/
      2025-4/           ciclo arquivado              → historico/2025-4/
        treino-1..5.md
      treino-1..5.md    ciclo corrente               → historico/atual/
    index.md            home do site                 → descartar
  .firebaserc
  firebase.json         public: .vitepress/dist      → atualizar
  package.json          deps do VitePress            → substituir
```

### Ordem das operações

A ordem importa: mover o markdown **antes** do scaffold, senão o scaffold do Vite
escreve em `src/` sobre o conteúdo.

```bash
git checkout -b migracao-app

# 1. preservar histórico de treino (DD-A16)
mkdir -p historico
git mv src/days/2025-4 historico/2025-4
mkdir -p historico/atual
git mv src/days/treino-1.md historico/atual/
git mv src/days/treino-2.md historico/atual/
git mv src/days/treino-3.md historico/atual/
git mv src/days/treino-4.md historico/atual/
git mv src/days/treino-5.md historico/atual/
git rm src/index.md
git commit -m "move fichas markdown para historico/ antes da migracao"

# 2. remover VitePress
git rm -r .vitepress
npm uninstall vitepress

# 3. scaffold do app
npm create vite@latest . -- --template vue-ts
npm install pinia vue-router firebase
npm install -D vite-plugin-pwa
```

### `firebase.json`

VitePress publica `.vitepress/dist` e não precisa de rewrite. Um SPA com Vue Router
em history mode precisa de rewrite, senão qualquer rota que não `/` dá 404 no
refresh. E os headers de DD-A11 são obrigatórios, ou o Hosting serve `index.html`
e `sw.js` de cache e o usuário fica preso numa versão antiga.

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      },
      {
        "source": "/sw.js",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      },
      {
        "source": "/manifest.webmanifest",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      },
      {
        "source": "/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  },
  "database": {
    "rules": "database.rules.json"
  }
}
```

### `.gitignore`

```
node_modules/
dist/
dev-dist/
.firebase/
.env*
```

`dev-dist/` é gerado pelo `vite-plugin-pwa` em desenvolvimento.

---

## 14. PWA, service worker e ícones

### `vite.config.ts`

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // Revisado para "prompt" — ver DD-A11. Com autoUpdate o SW recarrega a
      // página sozinho, e aqui isso cai no meio de uma série.
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icones/apple-touch-icon-180.png"],
      manifest: {
        name: "FichaTreino",
        short_name: "FichaTreino",
        description: "Controle de treino de hipertrofia com ciclos de rotação",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f1115",
        theme_color: "#0f1115",
        icons: [
          { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icones/icone-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        // RTDB usa WebSocket: não é interceptável por fetch handler e não deve
        // aparecer em runtimeCaching. Ver DD-A14.
        navigateFallbackDenylist: [/^\/__/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "avatares-google",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ]
});
```

`purpose: "any"` e `purpose: "maskable"` em entradas **separadas**. Declarar
`purpose: "any maskable"` no mesmo ícone faz o Android aplicar recorte adaptativo
numa arte que não tem safe zone, e o resultado é o logo cortado.

### Ícones a gerar

Arte-fonte em SVG, PNG derivado no build (DD-A15).

| Arquivo | Tamanho | Uso | Observação |
|---|---|---|---|
| `favicon.svg` | vetorial | aba do browser | fonte de verdade |
| `icone-192.png` | 192×192 | manifest, mínimo de instalabilidade Android | arte ocupa ~90% do quadro |
| `icone-512.png` | 512×512 | manifest, splash Android | idem |
| `icone-maskable-192.png` | 192×192 | ícone adaptativo Android | **safe zone: arte dentro de 80% central**, resto é sangria de fundo |
| `icone-maskable-512.png` | 512×512 | idem | idem |
| `apple-touch-icon-180.png` | 180×180 | iOS home screen | **iOS ignora o manifest**; precisa da tag `<link rel="apple-touch-icon">` no `index.html`. Sem transparência — iOS pinta o alfa de preto. |

Safe zone maskable: o Android pode recortar o ícone em círculo, squircle, gota ou
quadrado arredondado, dependendo do launcher. Só o círculo inscrito de 80% do lado é
garantido visível. Qualquer elemento fora disso pode desaparecer.

### `scripts/gerar-icones.ts`

```
assets/icones/icone.svg           →  icone-{192,512}.png
assets/icones/icone-maskable.svg  →  icone-maskable-{192,512}.png, apple-touch-icon-180.png
                                     (com fundo sólido, sem alfa)
```

Rasterização com `sharp` (`sharp(svg).resize(n).png()`) ou `@resvg/resvg-js`. Rodar
como `prebuild` no `package.json` para os PNGs nunca ficarem dessincronizados da
arte. Não versione os PNGs gerados; versione só os SVGs.

Duas artes SVG separadas, não uma: a maskable precisa de composição diferente (arte
menor, fundo sangrado), não é a mesma arte reescalada.

### `index.html`

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icones/apple-touch-icon-180.png" />
<meta name="theme-color" content="#0f1115" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

`viewport-fit=cover` mais `env(safe-area-inset-*)` no CSS: sem isso, o app instalado
no iPhone tem conteúdo sob a barra inferior de gestos — e a barra é exatamente onde
os botões de registrar série vão ficar.

### Instalação no iOS

O iOS não dispara `beforeinstallprompt` nem mostra prompt de instalação. Detecte
Safari em iOS sem `navigator.standalone` e mostre instrução manual na `Config`:
*Compartilhar → Adicionar à Tela de Início*. Sem isso, usuário de iPhone nunca
descobre que o app é instalável — e no iOS o app instalado tem garantia de storage
melhor que a aba do Safari, o que importa para a eviction de IndexedDB.
