import { computed, onScopeDispose, ref } from "vue";

/**
 * Contagem regressiva por timestamp.
 *
 * **Nunca acumule ticks.** `setInterval` é throttled quando a aba vai para
 * segundo plano — e ir para segundo plano é exatamente o que acontece com o
 * celular no bolso entre séries. Um timer que soma 1s por tick atrasa minutos.
 * Aqui o intervalo só reamostra `Date.now()`; o valor exibido é sempre a
 * diferença até o instante-alvo.
 */
export function useTimer() {
  const alvo = ref<number | null>(null);
  const agora = ref(Date.now());
  const duracaoMs = ref(0);

  let intervalo: ReturnType<typeof setInterval> | undefined;

  const restanteMs = computed(() => (alvo.value === null ? 0 : Math.max(0, alvo.value - agora.value)));
  const rodando = computed(() => alvo.value !== null && restanteMs.value > 0);
  const terminou = computed(() => alvo.value !== null && restanteMs.value === 0);

  const fracaoDecorrida = computed(() => {
    if (!duracaoMs.value) return 0;
    return Math.min(1, 1 - restanteMs.value / duracaoMs.value);
  });

  const texto = computed(() => {
    const total = Math.ceil(restanteMs.value / 1000);
    const min = Math.floor(total / 60);
    const seg = total % 60;
    return `${min}:${String(seg).padStart(2, "0")}`;
  });

  function amostrar(): void {
    agora.value = Date.now();
    if (alvo.value !== null && agora.value >= alvo.value) pausarIntervalo();
  }

  function pausarIntervalo(): void {
    if (intervalo) clearInterval(intervalo);
    intervalo = undefined;
  }

  function iniciar(segundos: number): void {
    duracaoMs.value = Math.max(0, segundos) * 1000;
    alvo.value = Date.now() + duracaoMs.value;
    agora.value = Date.now();

    pausarIntervalo();
    intervalo = setInterval(amostrar, 250);
  }

  function parar(): void {
    pausarIntervalo();
    alvo.value = null;
    duracaoMs.value = 0;
  }

  function somar(segundos: number): void {
    if (alvo.value === null) return;
    alvo.value += segundos * 1000;
    duracaoMs.value += segundos * 1000;
    if (!intervalo) intervalo = setInterval(amostrar, 250);
  }

  // Voltar do segundo plano reamostra na hora, sem esperar o próximo tick.
  const aoVoltar = () => amostrar();
  globalThis.addEventListener?.("visibilitychange", aoVoltar);

  onScopeDispose(() => {
    pausarIntervalo();
    globalThis.removeEventListener?.("visibilitychange", aoVoltar);
  });

  return { restanteMs, rodando, terminou, texto, fracaoDecorrida, iniciar, parar, somar };
}
