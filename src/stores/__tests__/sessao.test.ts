/**
 * Store de sessão — o caminho que o usuário percorre com o celular na mão.
 *
 * Cobre o que o checkpoint da Fase 6 exige: registrar sem rede, não perder dado
 * ao recarregar no meio, e a sugestão de carga aparecer na segunda execução do
 * mesmo treino.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import * as outbox from "../../db/outbox.ts";
import * as repos from "../../db/repos.ts";
import { useCargasStore } from "../cargas.ts";
import { useCicloStore } from "../ciclo.ts";
import { useConfigStore } from "../config.ts";
import { useMetodologiaStore } from "../metodologia.ts";
import { HORAS_ATE_SESSAO_VELHA, useSessaoStore } from "../sessao.ts";
import { zerarBd } from "../../testes/bd.ts";

const UID = "uid-sessao";

async function montar() {
  setActivePinia(createPinia());
  const config = useConfigStore();
  const met = useMetodologiaStore();
  const ciclo = useCicloStore();
  const cargas = useCargasStore();
  const sessao = useSessaoStore();

  await config.carregar(UID);
  await met.carregar(UID, "v1");
  await ciclo.carregar(UID);
  await cargas.carregar(UID);
  await sessao.carregar(UID);

  return { config, met, ciclo, cargas, sessao };
}

beforeEach(zerarBd);
afterEach(async () => {
  vi.useRealTimers();
  await zerarBd();
});

describe("início de sessão", () => {
  test("cria sessão ativa carimbando ciclo, semana e versões", async () => {
    const { sessao, ciclo } = await montar();
    const nova = await sessao.iniciar(UID, "T1");

    expect(nova).toMatchObject({
      uid: UID,
      treinoId: "T1",
      status: "ativa",
      ciclo: ciclo.cicloAtual,
      semana: ciclo.semanaAtual,
      metodologiaVersao: "v1",
      geradorVersao: "g1",
    });
    expect(sessao.ativa?.id).toBe(nova.id);
  });

  test("DD-A07 · reiniciar o mesmo treino retoma em vez de duplicar", async () => {
    const { sessao } = await montar();
    const primeira = await sessao.iniciar(UID, "T1");
    await sessao.registrarSerie("T1-S1", 0, { peso: 60, reps: 10, rir: 2 });

    const segunda = await sessao.iniciar(UID, "T1");

    expect(segunda.id).toBe(primeira.id);
    expect(sessao.seriesDoSlot("T1-S1")).toHaveLength(1);
    expect((await repos.sessoesRecentes(UID)).length).toBe(1);
  });

  test("DD-A07 · iniciar outro treino descarta a sessão anterior", async () => {
    const { sessao } = await montar();
    const primeira = await sessao.iniciar(UID, "T1");
    const segunda = await sessao.iniciar(UID, "T2");

    expect(segunda.id).not.toBe(primeira.id);
    expect((await repos.lerSessao(primeira.id))?.status).toBe("descartada");
    expect(await repos.sessaoAtiva(UID)).toMatchObject({ id: segunda.id });
  });

  test("sessão parada há muitas horas é sinalizada como abandonada", async () => {
    const { sessao } = await montar();
    await sessao.iniciar(UID, "T1");
    expect(sessao.pareceAbandonada()).toBe(false);

    // Precisa ser função: um computed sobre Date.now() ficaria cacheado, e a
    // passagem do tempo é a única coisa que muda esta resposta.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (HORAS_ATE_SESSAO_VELHA + 1) * 60 * 60 * 1000);
    expect(sessao.pareceAbandonada()).toBe(true);
  });
});

describe("registro de série", () => {
  test("grava a série com o nome literal do exercício (DD-A05)", async () => {
    const { sessao } = await montar();
    await sessao.iniciar(UID, "T1");
    await sessao.registrarSerie("T1-S1", 0, { peso: 60, reps: 10, rir: 2 });

    const [serie] = sessao.seriesDoSlot("T1-S1");
    expect(serie).toMatchObject({ peso: 60, reps: 10, rir: 2 });
    expect(serie.exercicioNome).toBe("Supino Reto com Barra");
    expect(serie.exercicioId).toBe("supino-reto-barra");
  });

  test("recusa slot que não pertence ao treino", async () => {
    const { sessao } = await montar();
    await sessao.iniciar(UID, "T1");
    await expect(sessao.registrarSerie("T3-S1", 0, { peso: 1, reps: 1, rir: 1 })).rejects.toThrow(
      /Slot fora do treino/,
    );
  });

  test("DD-10 · bateuTopo só fica true com todas as séries no topo", async () => {
    const { sessao, cargas } = await montar();
    await sessao.iniciar(UID, "T1");

    // T1-S1 é 4 × 6-10.
    for (const reps of [10, 10, 10]) {
      const i = sessao.seriesDoSlot("T1-S1").length;
      await sessao.registrarSerie("T1-S1", i, { peso: 60, reps, rir: 1 });
    }
    await cargas.recarregar(UID);
    expect(cargas.ultima("supino-reto-barra")?.bateuTopo).toBe(false);

    await sessao.registrarSerie("T1-S1", 3, { peso: 60, reps: 10, rir: 0 });
    await cargas.recarregar(UID);
    expect(cargas.ultima("supino-reto-barra")?.bateuTopo).toBe(true);
  });

  test("uma série abaixo do topo derruba a progressão", async () => {
    const { sessao, cargas } = await montar();
    await sessao.iniciar(UID, "T1");

    for (const reps of [10, 10, 8, 10]) {
      const i = sessao.seriesDoSlot("T1-S1").length;
      await sessao.registrarSerie("T1-S1", i, { peso: 60, reps, rir: 1 });
    }
    await cargas.recarregar(UID);
    expect(cargas.ultima("supino-reto-barra")?.bateuTopo).toBe(false);
  });

  test("desfazer remove a série e permite regravar no mesmo índice", async () => {
    const { sessao } = await montar();
    await sessao.iniciar(UID, "T1");
    await sessao.registrarSerie("T1-S1", 0, { peso: 60, reps: 10, rir: 2 });
    await sessao.registrarSerie("T1-S1", 1, { peso: 999, reps: 1, rir: 0 });

    await sessao.desfazerSerie("T1-S1", 1);
    expect(sessao.seriesDoSlot("T1-S1")).toHaveLength(1);

    await sessao.registrarSerie("T1-S1", 1, { peso: 62.5, reps: 9, rir: 1 });
    expect(sessao.seriesDoSlot("T1-S1")[1]).toMatchObject({ peso: 62.5, reps: 9 });
  });

  test("progresso conta séries feitas sobre o alvo do treino", async () => {
    const { sessao, ciclo, config } = await montar();
    // DD-A18: o padrão é o modo simples; este teste mede o progresso por série.
    await config.salvar({ modoRegistro: "detalhado" });
    await sessao.iniciar(UID, "T1");

    const total = ciclo
      .treino("T1")!
      .itens.reduce((soma, i) => soma + Number(i.slot.series.match(/\d+/g)!.at(-1)), 0);

    expect(sessao.progresso).toEqual({ feitas: 0, total });
    await sessao.registrarSerie("T1-S1", 0, { peso: 60, reps: 10, rir: 2 });
    expect(sessao.progresso.feitas).toBe(1);
    expect(sessao.completa).toBe(false);
  });
});

describe("modo simples (DD-A18)", () => {
  test("marcar grava o nome literal do exercício (DD-A05) e nada em cargas", async () => {
    const { sessao, cargas } = await montar();
    await sessao.iniciar(UID, "T1");
    await sessao.marcarExercicio("T1-S1");

    const feito = sessao.exercicioFeito("T1-S1");
    expect(feito).toMatchObject({
      exercicioId: "supino-reto-barra",
      exercicioNome: "Supino Reto com Barra",
    });
    expect(feito?.concluidoEm).toBeGreaterThan(0);

    // Sem peso e reps não há progressão a derivar: cargas fica intocada.
    await cargas.recarregar(UID);
    expect(cargas.ultima("supino-reto-barra")).toBeUndefined();
  });

  test("recusa slot que não pertence ao treino", async () => {
    const { sessao } = await montar();
    await sessao.iniciar(UID, "T1");
    await expect(sessao.marcarExercicio("T3-S1")).rejects.toThrow(/Slot fora do treino/);
  });

  test("progresso conta exercícios e completa ao marcar todos", async () => {
    const { sessao, ciclo } = await montar();
    await sessao.iniciar(UID, "T1");

    const itens = ciclo.treino("T1")!.itens;
    expect(sessao.progresso).toEqual({ feitas: 0, total: itens.length });

    for (const item of itens) await sessao.marcarExercicio(item.slot.id);
    expect(sessao.progresso).toEqual({ feitas: itens.length, total: itens.length });
    expect(sessao.completa).toBe(true);
  });

  test("desmarcar remove a marcação e enfileira o remove no path exato", async () => {
    const { sessao } = await montar();
    await sessao.iniciar(UID, "T1");
    await sessao.marcarExercicio("T1-S1");
    await sessao.desmarcarExercicio("T1-S1");

    expect(sessao.exercicioFeito("T1-S1")).toBeNull();
    expect(sessao.progresso.feitas).toBe(0);

    const ops = await outbox.proximasPendentes(50);
    expect(ops.at(-1)).toMatchObject({
      op: "remove",
      path: expect.stringContaining("/exercicios/T1-S1"),
    });
  });

  test("marcações sobrevivem a reload no meio e a fila persiste (checkpoint)", async () => {
    const primeiro = await montar();
    await primeiro.sessao.iniciar(UID, "T1");
    await primeiro.sessao.marcarExercicio("T1-S1");
    await primeiro.sessao.marcarExercicio("T1-S2");

    const pendentesAntes = await outbox.contarPendentes();
    expect(pendentesAntes).toBeGreaterThan(0);

    // Reload: Pinia zerada, stores remontadas a partir do IndexedDB.
    const depois = await montar();

    expect(depois.sessao.ativa?.treinoId).toBe("T1");
    expect(depois.sessao.exercicioFeito("T1-S1")).not.toBeNull();
    expect(depois.sessao.exercicioFeito("T1-S2")).not.toBeNull();
    expect(depois.sessao.progresso.feitas).toBe(2);
    expect(await outbox.contarPendentes()).toBe(pendentesAntes);
  });
});

describe("encerramento", () => {
  test("finalizar conclui a sessão e ela passa a contar para a semana", async () => {
    const { sessao, ciclo } = await montar();
    await sessao.iniciar(UID, "T1");
    await sessao.registrarSerie("T1-S1", 0, { peso: 60, reps: 10, rir: 2 });

    await sessao.finalizar(UID);

    expect(sessao.ativa).toBeNull();
    expect(ciclo.sessoesConcluidas).toBe(1);
  });

  test("descartar não conta para a semana mas preserva o registro", async () => {
    const { sessao, ciclo } = await montar();
    const s = await sessao.iniciar(UID, "T1");
    await sessao.registrarSerie("T1-S1", 0, { peso: 60, reps: 10, rir: 2 });

    await sessao.descartar(UID);

    expect(sessao.ativa).toBeNull();
    expect(ciclo.sessoesConcluidas).toBe(0);
    expect((await repos.lerSessao(s.id))?.status).toBe("descartada");
  });
});

describe("checkpoint da Fase 6", () => {
  test("treino inteiro sem rede sobrevive a reload no meio", async () => {
    const primeiro = await montar();
    await primeiro.sessao.iniciar(UID, "T1");
    await primeiro.sessao.registrarSerie("T1-S1", 0, { peso: 60, reps: 10, rir: 2 });
    await primeiro.sessao.registrarSerie("T1-S1", 1, { peso: 60, reps: 9, rir: 1 });

    const pendentesAntes = await outbox.contarPendentes();
    expect(pendentesAntes).toBeGreaterThan(0);

    // Reload: Pinia zerada, stores remontadas a partir do IndexedDB.
    const depois = await montar();

    expect(depois.sessao.ativa?.treinoId).toBe("T1");
    expect(depois.sessao.seriesDoSlot("T1-S1")).toHaveLength(2);
    expect(depois.sessao.seriesDoSlot("T1-S1")[1]).toMatchObject({ peso: 60, reps: 9 });
    expect(await outbox.contarPendentes()).toBe(pendentesAntes);

    // Continua de onde parou.
    await depois.sessao.registrarSerie("T1-S1", 2, { peso: 60, reps: 10, rir: 1 });
    expect(depois.sessao.seriesDoSlot("T1-S1")).toHaveLength(3);
  });

  test("a sugestão de carga aparece na segunda execução do mesmo treino", async () => {
    const primeira = await montar();
    const slot = primeira.ciclo.treino("T1")!.itens.find((i) => i.slot.id === "T1-S1")!;

    // Primeira vez: sem histórico.
    expect(primeira.cargas.sugestao(slot.exercicioId, slot.slot)).toMatchObject({
      fonte: "sem-historico",
      peso: 0,
    });

    await primeira.sessao.iniciar(UID, "T1");
    for (let i = 0; i < 4; i++) {
      await primeira.sessao.registrarSerie("T1-S1", i, { peso: 60, reps: 10, rir: 1 });
    }
    await primeira.sessao.finalizar(UID);

    // Segunda execução: bateu o topo em todas, então sobe o incremento.
    const segunda = await montar();
    const sugestao = segunda.cargas.sugestao(slot.exercicioId, slot.slot);

    expect(sugestao.fonte).toBe("progressao");
    expect(sugestao.peso).toBe(62.5);
    expect(sugestao.motivo).toMatch(/bateu o topo/);
  });

  test("sem bater o topo, a segunda execução repete a carga", async () => {
    const primeira = await montar();
    const slot = primeira.ciclo.treino("T1")!.itens.find((i) => i.slot.id === "T1-S1")!;

    await primeira.sessao.iniciar(UID, "T1");
    for (const reps of [10, 10, 10, 7]) {
      const i = primeira.sessao.seriesDoSlot("T1-S1").length;
      await primeira.sessao.registrarSerie("T1-S1", i, { peso: 60, reps, rir: 0 });
    }
    await primeira.sessao.finalizar(UID);

    const segunda = await montar();
    expect(segunda.cargas.sugestao(slot.exercicioId, slot.slot)).toMatchObject({
      fonte: "ultima",
      peso: 60,
    });
  });
});
