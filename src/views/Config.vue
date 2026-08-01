<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import IndicadorSync from "../components/IndicadorSync.vue";
import StepperNumero from "../components/StepperNumero.vue";
import { useInstalacao } from "../composables/useInstalacao.ts";
import { useAuthStore } from "../stores/auth.ts";
import { useCicloStore } from "../stores/ciclo.ts";
import { useConfigStore } from "../stores/config.ts";
import { useMetodologiaStore } from "../stores/metodologia.ts";
import { useSyncStore } from "../stores/sync.ts";

const auth = useAuthStore();
const config = useConfigStore();
const ciclo = useCicloStore();
const met = useMetodologiaStore();
const sync = useSyncStore();
const instalacao = useInstalacao();

const armazenamentoPersistente = ref<boolean | null>(null);
const exportando = ref(false);
const filtroExercicio = ref("");

onMounted(async () => {
  armazenamentoPersistente.value = (await navigator.storage?.persisted?.()) ?? null;
});

const incremento = computed({
  get: () => config.incremento,
  set: (valor: number) => void config.salvar({ incrementoPadrao: valor }),
});

const semanaManual = computed(() => config.config?.semanaManual ?? null);

const exercicios = computed(() => {
  const catalogo = met.metodologia?.exercicios ?? {};
  const termo = filtroExercicio.value.trim().toLowerCase();

  return Object.entries(catalogo)
    .map(([id, ex]) => ({ id, nome: ex.nome, indisponivel: Boolean(config.config?.indisponiveis?.[id]) }))
    .filter((e) => (termo ? e.nome.toLowerCase().includes(termo) : e.indisponivel))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
});

const qtdIndisponiveis = computed(() => config.indisponiveis.length);

async function ativarPersistencia(): Promise<void> {
  armazenamentoPersistente.value = await config.pedirArmazenamentoPersistente();
}

async function exportar(): Promise<void> {
  if (!auth.uid) return;
  exportando.value = true;
  try {
    await config.exportar(auth.uid);
  } finally {
    exportando.value = false;
  }
}
</script>

<template>
  <main class="pagina">
    <header class="topo">
      <h1>Ajustes</h1>
      <IndicadorSync />
    </header>

    <section class="bloco">
      <h2 class="bloco__titulo">Conta</h2>
      <p class="bloco__linha">{{ auth.user?.email ?? "—" }}</p>
      <button class="botao botao--secundario" type="button" @click="auth.encerrar()">Sair</button>
    </section>

    <section class="bloco">
      <h2 class="bloco__titulo">Progressão de carga</h2>
      <p class="bloco__nota">
        Incremento sugerido quando você bate o topo da faixa de repetições em todas as séries.
      </p>
      <StepperNumero
        v-model="incremento"
        :passo="0.5"
        :minimo="0"
        :maximo="20"
        :casas="1"
        rotulo="Incremento"
        :sufixo="config.config?.unidade ?? 'kg'"
      />
    </section>

    <section class="bloco">
      <h2 class="bloco__titulo">Ciclo e semana</h2>
      <p class="bloco__linha">
        Ciclo {{ ciclo.cicloAtual }} · Semana {{ ciclo.semanaAtual }} de {{ ciclo.semanasPorCiclo }}
        <template v-if="ciclo.faseProgressao"> · {{ ciclo.faseProgressao.rir }}</template>
      </p>
      <p class="bloco__nota">
        A semana normalmente deriva das sessões concluídas ({{ ciclo.sessoesConcluidas }} neste
        ciclo). Use o ajuste manual só se você entrou no ciclo pelo meio.
      </p>

      <div class="semana">
        <button
          class="botao botao--secundario"
          type="button"
          :disabled="semanaManual === null"
          @click="config.salvar({ semanaManual: null })"
        >
          Automática
        </button>
        <button
          v-for="n in ciclo.semanasPorCiclo"
          :key="n"
          class="semana__n"
          :class="{ 'semana__n--ativa': semanaManual === n }"
          type="button"
          @click="config.salvar({ semanaManual: n })"
        >
          {{ n }}
        </button>
      </div>
    </section>

    <section class="bloco">
      <h2 class="bloco__titulo">Equipamento indisponível</h2>
      <p class="bloco__nota">
        Filtro permanente: exercícios marcados saem do sorteio dos próximos ciclos. Para uma troca
        pontual num ciclo só, use o override na tela de Ciclo.
        <template v-if="qtdIndisponiveis"> {{ qtdIndisponiveis }} marcado(s).</template>
      </p>

      <input
        v-model="filtroExercicio"
        class="busca"
        type="search"
        placeholder="Buscar exercício para marcar…"
        aria-label="Buscar exercício"
      />

      <ul v-if="exercicios.length" class="exercicios">
        <li v-for="ex in exercicios" :key="ex.id" class="exercicios__item">
          <label class="exercicios__rotulo">
            <input
              type="checkbox"
              :checked="ex.indisponivel"
              @change="config.definirIndisponivel(ex.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ ex.nome }}</span>
          </label>
        </li>
      </ul>
      <p v-else-if="filtroExercicio" class="bloco__nota">Nenhum exercício com esse nome.</p>
    </section>

    <section class="bloco">
      <h2 class="bloco__titulo">Instalar no celular</h2>

      <p v-if="instalacao.instalado.value" class="bloco__linha">App instalado.</p>

      <template v-else-if="instalacao.precisaDeInstrucaoManual()">
        <!-- iOS não dispara beforeinstallprompt: sem esta instrução o usuário
             de iPhone nunca descobre que dá para instalar (DD-A15). -->
        <p class="bloco__nota">
          No iPhone, toque em <strong>Compartilhar</strong> na barra do Safari e escolha
          <strong>Adicionar à Tela de Início</strong>.
        </p>
        <p class="bloco__nota">
          Instalado, o app abre em tela cheia e o armazenamento fica mais protegido — importante saber que o
          Safari apaga os dados de abas comuns depois de cerca de sete dias sem uso.
        </p>
      </template>

      <template v-else>
        <p class="bloco__nota">
          Instalado, o app abre offline e em tela cheia, sem a barra do navegador.
        </p>
        <button
          class="botao"
          type="button"
          :disabled="!instalacao.podeInstalar.value"
          @click="instalacao.instalar()"
        >
          {{ instalacao.podeInstalar.value ? "Instalar app" : "Instalação indisponível aqui" }}
        </button>
        <p v-if="!instalacao.podeInstalar.value" class="bloco__nota">
          O navegador ainda não ofereceu a instalação. No Chrome, ela também aparece no menu ⋮ →
          Instalar aplicativo.
        </p>
      </template>
    </section>

    <section class="bloco">
      <h2 class="bloco__titulo">Dados</h2>

      <p class="bloco__linha">
        Metodologia <strong>{{ config.metodologiaVersao }}</strong> · gerador
        <strong>{{ config.config?.geradorVersao }}</strong>
      </p>
      <p class="bloco__nota">
        Trocar de versão com um ciclo em andamento é bloqueado: mudar os pools no meio invalidaria
        as cargas em progresso.
      </p>

      <p class="bloco__linha">
        Sincronização: {{ sync.pendentes }} pendente(s)
        <template v-if="sync.travadas.length"> · {{ sync.travadas.length }} travada(s)</template>
      </p>

      <!--
        Uma operação travada bloqueia a fila inteira, de propósito: pular
        aplicaria escritas cuja precondição não chegou ao servidor. Mas fila
        parada sem explicação é indiagnosticável — o caso real foi
        PERMISSION_DENIED porque /metodologia/v1 ainda não tinha sido semeada, e
        a regra de validação exige que ela exista.
      -->
      <div v-if="sync.travadas.length" class="travadas">
        <p class="travadas__aviso">
          A fila está parada na primeira operação travada — nada sincroniza até resolver.
        </p>
        <ul class="travadas__lista">
          <li v-for="op in sync.travadas" :key="op.id" class="travadas__item">
            <code>{{ op.op }} {{ op.path }}</code>
            <span class="travadas__erro">{{ op.ultimoErro }}</span>
          </li>
        </ul>
        <button class="botao botao--secundario" type="button" @click="sync.destravar()">
          Tentar de novo
        </button>
      </div>

      <p class="bloco__linha">
        Armazenamento persistente:
        <strong>{{ armazenamentoPersistente === null ? "indisponível" : armazenamentoPersistente ? "ativo" : "inativo" }}</strong>
      </p>
      <button
        v-if="armazenamentoPersistente === false"
        class="botao botao--secundario"
        type="button"
        @click="ativarPersistencia"
      >
        Pedir armazenamento persistente
      </button>

      <button class="botao botao--secundario" type="button" :disabled="exportando" @click="exportar">
        {{ exportando ? "Exportando…" : "Exportar meus dados (JSON)" }}
      </button>
      <p class="bloco__nota">
        O export sai do armazenamento local, então funciona offline: sessões, cargas, overrides e
        configuração.
      </p>
    </section>
  </main>
</template>

<style scoped>
.topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.topo h1 {
  margin: 0;
}

.bloco {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
}

.bloco__titulo {
  margin: 0;
  font-size: 1rem;
}

.bloco__linha {
  margin: 0;
  font-size: 0.9375rem;
}

.bloco__nota {
  margin: 0;
  color: var(--texto-suave);
  font-size: 0.8125rem;
}

.botao {
  min-height: var(--toque-min);
  padding: 0 1rem;
  border: 1px solid transparent;
  border-radius: var(--raio);
  background: var(--acento);
  color: #fff;
  font-weight: 600;
}

.botao--secundario {
  background: none;
  border-color: var(--borda);
  color: var(--texto);
  font-weight: 500;
}

.botao:disabled {
  opacity: 0.5;
}

.semana {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.semana__n {
  min-width: var(--toque-min);
  min-height: var(--toque-min);
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: none;
}

.semana__n--ativa {
  border-color: var(--acento);
  background: var(--acento);
  color: #fff;
}

.travadas {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--perigo);
  border-radius: var(--raio);
}

.travadas__aviso {
  margin: 0;
  color: var(--perigo);
  font-size: 0.8125rem;
}

.travadas__lista {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.travadas__item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.travadas__erro {
  color: var(--texto-suave);
}

.busca {
  min-height: var(--toque-min);
  padding: 0 0.75rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo);
  color: var(--texto);
  font: inherit;
}

.exercicios {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  max-height: 18rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.exercicios__rotulo {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: var(--toque-min);
  padding: 0 0.25rem;
  font-size: 0.9375rem;
}

.exercicios__rotulo input {
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--acento);
}
</style>
