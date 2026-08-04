<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import ExercicioCard from "../components/ExercicioCard.vue";
import ExercicioCheck from "../components/ExercicioCheck.vue";
import IndicadorSync from "../components/IndicadorSync.vue";
import TimerDescanso from "../components/TimerDescanso.vue";
import { useWakeLock } from "../composables/useWakeLock.ts";
import { useAuthStore } from "../stores/auth.ts";
import { useCargasStore } from "../stores/cargas.ts";
import { useCicloStore } from "../stores/ciclo.ts";
import { useConfigStore } from "../stores/config.ts";
import { useSessaoStore } from "../stores/sessao.ts";

const props = defineProps<{ treinoId: string }>();

const router = useRouter();
const auth = useAuthStore();
const ciclo = useCicloStore();
const config = useConfigStore();
const cargas = useCargasStore();
const sessao = useSessaoStore();
const wakeLock = useWakeLock();

const abertoId = ref<string | null>(null);
const salvando = ref(false);
const confirmandoDescarte = ref(false);
const timer = ref<InstanceType<typeof TimerDescanso> | null>(null);

const treino = computed(() => ciclo.treino(props.treinoId));
const emAndamento = computed(() => sessao.ativa?.treinoId === props.treinoId);

/** DD-A18: no modo simples a tela é uma checklist — sem carga, reps ou timer. */
const modoSimples = computed(() => config.modoRegistro === "simples");

/**
 * Descanso sugerido para um slot.
 *
 * `meta.descanso` descreve dois regimes num texto só — ex. "2-3 min nos
 * compostos · 60-90s nos isoladores". Aplicar o maior a todos os slots dá 3
 * minutos de espera no aquecimento de manguito; aplicar o menor deixa o
 * composto pesado sem recuperação. A separação usa `slot.ancora`, que por DD-03
 * marca justamente os compostos pesados — nenhum dado novo é inventado.
 *
 * É só o valor inicial: o timer tem "+30s" e "Pular".
 */
function descansoDoSlot(ancora: boolean): number {
  const texto = treino.value?.meta.descanso ?? "";
  const emMinutos = /(\d+)\s*(?:-\s*(\d+)\s*)?min/.exec(texto);
  const emSegundos = /(\d+)\s*(?:-\s*(\d+)\s*)?s(?:eg|\b)/.exec(texto);

  const topo = (m: RegExpExecArray | null) => (m ? Number(m[2] ?? m[1]) : null);

  const minutos = topo(emMinutos);
  const segundos = topo(emSegundos);

  if (ancora && minutos !== null) return minutos * 60;
  if (segundos !== null) return segundos;
  if (minutos !== null) return minutos * 60;
  return 90;
}

/** Default do componente quando não há slot em contexto. */
const descansoPadrao = computed(() => descansoDoSlot(false));

/** Primeiro exercício ainda incompleto — para onde a tela abre sozinha. */
const proximoIncompleto = computed(() => {
  for (const item of treino.value?.itens ?? []) {
    const feitas = sessao.seriesDoSlot(item.slot.id).length;
    if (feitas < Number(item.slot.series.match(/\d+/g)?.at(-1) ?? 3)) return item.slot.id;
  }
  return null;
});

onMounted(async () => {
  if (!auth.uid) return;
  await sessao.carregar(auth.uid);
  if (emAndamento.value) await wakeLock.ativar();
  abertoId.value = proximoIncompleto.value;
});

watch(
  () => sessao.ativa?.id,
  () => {
    if (!abertoId.value) abertoId.value = proximoIncompleto.value;
  },
);

async function iniciar(): Promise<void> {
  if (!auth.uid) return;
  await sessao.iniciar(auth.uid, props.treinoId);
  await wakeLock.ativar();
  abertoId.value = proximoIncompleto.value;
}

async function registrar(slotId: string, dados: { peso: number; reps: number; rir: number | null }) {
  const indice = sessao.seriesDoSlot(slotId).length;

  const ancora = treino.value?.itens.find((i) => i.slot.id === slotId)?.slot.ancora ?? false;

  salvando.value = true;
  try {
    // Commit local — não espera rede, não mostra spinner de sincronização.
    await sessao.registrarSerie(slotId, indice, dados);
    timer.value?.iniciar(descansoDoSlot(ancora));

    const proximo = proximoIncompleto.value;
    if (proximo && proximo !== slotId) abertoId.value = proximo;
  } finally {
    salvando.value = false;
  }
}

/** Modo simples: um toque marca, o mesmo toque desfaz. */
async function alternarExercicio(slotId: string): Promise<void> {
  if (sessao.exercicioFeito(slotId)) await sessao.desmarcarExercicio(slotId);
  else await sessao.marcarExercicio(slotId);
}

const perguntaDescarte = computed(() => {
  const n = sessao.progresso.feitas;
  if (modoSimples.value) {
    return n === 1 ? "Descartar o exercício já marcado?" : `Descartar os ${n} exercícios já marcados?`;
  }
  return n === 1 ? "Descartar a série já registrada?" : `Descartar as ${n} séries já registradas?`;
});

async function finalizar(): Promise<void> {
  if (!auth.uid) return;
  await sessao.finalizar(auth.uid);
  await wakeLock.liberar();
  timer.value?.parar();
  void router.push({ name: "home" });
}

async function descartar(): Promise<void> {
  if (!auth.uid) return;
  await sessao.descartar(auth.uid);
  await wakeLock.liberar();
  timer.value?.parar();
  confirmandoDescarte.value = false;
  void router.push({ name: "home" });
}
</script>

<template>
  <main class="treino">
    <header class="treino__topo">
      <RouterLink class="treino__voltar" :to="{ name: 'home' }" aria-label="Voltar">‹</RouterLink>
      <div class="treino__identidade">
        <h1 class="treino__titulo">{{ treino?.meta.id }} · {{ treino?.meta.titulo }}</h1>
        <p class="treino__sub">
          Ciclo {{ ciclo.cicloAtual }} · Semana {{ ciclo.semanaAtual }}
          <template v-if="ciclo.faseProgressao"> · {{ ciclo.faseProgressao.rir }}</template>
        </p>
      </div>
      <IndicadorSync />
    </header>

    <p v-if="!treino" class="pendente">Treino não encontrado neste ciclo.</p>

    <template v-else>
      <section v-if="!emAndamento" class="iniciar">
        <p class="iniciar__objetivo">{{ treino.meta.objetivo }}</p>
        <p class="iniciar__descanso">Descanso: {{ treino.meta.descanso }}</p>
        <button class="iniciar__botao" type="button" @click="iniciar">Iniciar treino</button>
      </section>

      <template v-else>
        <div class="barra">
          <div class="barra__preenchida" :style="{ width: `${(sessao.progresso.feitas / Math.max(1, sessao.progresso.total)) * 100}%` }" />
        </div>
        <p class="progresso-texto">
          {{ sessao.progresso.feitas }} de {{ sessao.progresso.total }}
          {{ modoSimples ? "exercícios" : "séries" }}
          <span v-if="wakeLock.ativo.value" class="progresso-texto__tela">· tela travada acesa</span>
        </p>

        <div v-if="modoSimples" class="lista">
          <ExercicioCheck
            v-for="item in treino.itens"
            :key="item.slot.id"
            :item="item"
            :feito="Boolean(sessao.exercicioFeito(item.slot.id))"
            @alternar="alternarExercicio(item.slot.id)"
          />
        </div>

        <div v-else class="lista">
          <ExercicioCard
            v-for="item in treino.itens"
            :key="item.slot.id"
            :item="item"
            :series="sessao.seriesDoSlot(item.slot.id)"
            :sugestao="cargas.sugestao(item.exercicioId, item.slot)"
            :incremento="config.incremento"
            :unidade="config.config?.unidade ?? 'kg'"
            :rir="ciclo.faseProgressao?.rir ?? ''"
            :expandido="abertoId === item.slot.id"
            :salvando="salvando"
            @alternar="abertoId = abertoId === item.slot.id ? null : item.slot.id"
            @registrar="registrar(item.slot.id, $event)"
            @desfazer="sessao.desfazerSerie(item.slot.id, $event)"
          />
        </div>

        <TimerDescanso v-if="!modoSimples" ref="timer" :segundos="descansoPadrao" />

        <section class="encerrar">
          <button class="encerrar__concluir" type="button" @click="finalizar">
            {{ sessao.completa ? "Concluir treino" : "Concluir mesmo assim" }}
          </button>

          <button
            v-if="!confirmandoDescarte"
            class="encerrar__descartar"
            type="button"
            @click="confirmandoDescarte = true"
          >
            Descartar sessão
          </button>
          <div v-else class="encerrar__confirma">
            <p class="encerrar__pergunta">
              {{ perguntaDescarte }}
              Não dá para desfazer.
            </p>
            <div class="encerrar__acoes">
              <button class="encerrar__nao" type="button" @click="confirmandoDescarte = false">
                Cancelar
              </button>
              <button class="encerrar__sim" type="button" @click="descartar">Descartar</button>
            </div>
          </div>
        </section>
      </template>
    </template>
  </main>
</template>

<style scoped>
.treino {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 100dvh;
  padding: calc(0.75rem + var(--safe-top)) 0.75rem calc(1rem + var(--safe-bottom));
  /* não disparar pull-to-refresh no meio do treino */
  overscroll-behavior: contain;
}

.treino__topo {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
}

.treino__voltar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--toque-min);
  height: var(--toque-min);
  border-radius: var(--raio);
  color: var(--texto);
  font-size: 1.75rem;
  line-height: 1;
  text-decoration: none;
}

.treino__titulo {
  margin: 0;
  font-size: 1.0625rem;
}

.treino__sub {
  margin: 0;
  color: var(--texto-suave);
  font-size: 0.75rem;
}

.iniciar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
}

.iniciar__objetivo {
  margin: 0;
}

.iniciar__descanso {
  margin: 0 0 0.5rem;
  color: var(--texto-suave);
  font-size: 0.875rem;
}

.iniciar__botao {
  min-height: 3.25rem;
  border: none;
  border-radius: var(--raio);
  background: var(--acento);
  color: #fff;
  font-size: 1.0625rem;
  font-weight: 600;
}

.barra {
  height: 0.375rem;
  border-radius: 999px;
  background: var(--borda);
  overflow: hidden;
}

.barra__preenchida {
  height: 100%;
  background: var(--ok);
  transition: width 0.2s ease;
}

.progresso-texto {
  margin: 0;
  color: var(--texto-suave);
  font-size: 0.8125rem;
}

.progresso-texto__tela {
  opacity: 0.7;
}

.lista {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.encerrar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.encerrar__concluir {
  min-height: 3rem;
  border: 1px solid var(--ok);
  border-radius: var(--raio);
  background: none;
  color: var(--ok);
  font-size: 1rem;
  font-weight: 600;
}

.encerrar__descartar {
  min-height: var(--toque-min);
  border: none;
  background: none;
  color: var(--texto-suave);
  font-size: 0.875rem;
  text-decoration: underline;
}

/* Pergunta em cima, botões embaixo em colunas iguais. Antes era um flex-wrap
   em linha: a pergunta empurrava "Descartar" para o lado e "Cancelar" caía
   sozinho na linha de baixo, desalinhado. */
.encerrar__confirma {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem;
  border: 1px solid var(--perigo);
  border-radius: var(--raio);
}

.encerrar__pergunta {
  margin: 0;
  font-size: 0.9375rem;
}

.encerrar__acoes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.encerrar__sim,
.encerrar__nao {
  min-height: var(--toque-min);
  padding: 0 0.875rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: none;
  font-size: 0.9375rem;
}

/* Ação destrutiva à direita e sem preenchimento sólido: o toque acidental mais
   provável é no lado do polegar, e "Cancelar" é o destino seguro. */
.encerrar__sim {
  border-color: var(--perigo);
  color: var(--perigo);
}
</style>
