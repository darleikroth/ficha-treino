/**
 * Store de ciclo.
 *
 * O que importa aqui é que `ciclo` seja de fato uma projeção do gerador, e não
 * uma cópia que possa divergir: se a store passar a guardar o ciclo em estado,
 * o determinismo deixa de pagar e volta a existir dado derivado para invalidar.
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { criarGerador } from "../../core/gerador.ts";
import { METODOLOGIA_V1 } from "../../core/metodologia.ts";
import type { Sessao } from "../../db/esquema.ts";
import * as repos from "../../db/repos.ts";
import { useCicloStore } from "../ciclo.ts";
import { useConfigStore } from "../config.ts";
import { useMetodologiaStore } from "../metodologia.ts";
import { useSyncStore } from "../sync.ts";
import { zerarBd } from "../../testes/bd.ts";

const UID = "uid-ciclo";
const referencia = criarGerador(METODOLOGIA_V1);

async function montar() {
  setActivePinia(createPinia());
  const config = useConfigStore();
  const met = useMetodologiaStore();
  const ciclo = useCicloStore();

  await config.carregar(UID);
  await met.carregar(UID, "v1");
  await ciclo.carregar(UID);

  return { config, met, ciclo };
}

const sessao = (i: number, ciclo: number, status: Sessao["status"]): Sessao => ({
  id: `17000000000${String(i).padStart(2, "0")}-aaaa`,
  uid: UID,
  treinoId: "T1",
  ciclo,
  semana: 1,
  metodologiaVersao: "v1",
  geradorVersao: "g1",
  status,
  inicioEm: i,
  fimEm: i,
  series: {},
});

beforeEach(zerarBd);
afterEach(zerarBd);

describe("projeção do gerador", () => {
  test("o ciclo exibido é o que o gerador produz, slot a slot", async () => {
    const { ciclo } = await montar();
    expect(ciclo.cicloAtual).toBe(1);
    expect(ciclo.ciclo?.porSlot).toEqual(referencia.gerarCiclo(1).porSlot);
  });

  test("volume semanal bate com volumeSemanal() do gerador", async () => {
    const { ciclo } = await montar();
    expect(ciclo.volumeSemanal).toEqual(referencia.volumeSemanal());
  });

  test("treino(id) devolve o treino correspondente", async () => {
    const { ciclo } = await montar();
    const t3 = ciclo.treino("T3");
    expect(t3?.meta.id).toBe("T3");
    expect(t3?.itens.length).toBeGreaterThan(0);
    expect(ciclo.treino("T9")).toBeNull();
  });

  test("os avisos do Ciclo 1 não são mostrados — é a ficha fixada, não escolha do gerador", async () => {
    const { ciclo } = await montar();
    expect(ciclo.ciclo?.fixado).toBe(true);
    expect(referencia.validar(ciclo.ciclo!.porSlot).length).toBeGreaterThan(0);
    expect(ciclo.avisos).toEqual([]);
  });

  test("indisponíveis refletem no ciclo sem precisar recarregar nada", async () => {
    const { config, ciclo } = await montar();
    // Ciclo 2, porque o 1 é fixado e ignora o filtro.
    await repos.aplicarConfigRemota({ ...config.config!, cicloAtual: 2 });
    await config.recarregar(UID);

    const antes = ciclo.ciclo!.porSlot["T1-S2"];
    await config.definirIndisponivel(antes, true);

    expect(ciclo.ciclo!.porSlot["T1-S2"]).not.toBe(antes);
  });
});

describe("DD-A08 · semana do ciclo", () => {
  test("deriva de sessões concluídas, não de data", async () => {
    const { ciclo } = await montar();
    expect(ciclo.semanaAtual).toBe(1);

    for (let i = 0; i < 5; i++) await repos.aplicarSessaoRemota(sessao(i, 1, "concluida"));
    await ciclo.recontarSessoes(UID);

    expect(ciclo.sessoesConcluidas).toBe(5);
    expect(ciclo.semanaAtual).toBe(2);
    expect(ciclo.faseProgressao?.rir).toBe("RIR 3");
  });

  test("sessão ativa ou descartada não conta", async () => {
    const { ciclo } = await montar();
    await repos.aplicarSessaoRemota(sessao(0, 1, "concluida"));
    await repos.aplicarSessaoRemota(sessao(1, 1, "ativa"));
    await repos.aplicarSessaoRemota(sessao(2, 1, "descartada"));
    await ciclo.recontarSessoes(UID);

    expect(ciclo.sessoesConcluidas).toBe(1);
  });

  test("sessão de outro ciclo não conta para a semana deste", async () => {
    const { ciclo } = await montar();
    for (let i = 0; i < 7; i++) await repos.aplicarSessaoRemota(sessao(i, 2, "concluida"));
    await ciclo.recontarSessoes(UID);

    expect(ciclo.cicloAtual).toBe(1);
    expect(ciclo.sessoesConcluidas).toBe(0);
    expect(ciclo.semanaAtual).toBe(1);
  });

  test("semanaManual sobrepõe e é limitada ao tamanho do ciclo", async () => {
    const { config, ciclo } = await montar();

    await config.salvar({ semanaManual: 6 });
    expect(ciclo.semanaAtual).toBe(6);
    expect(ciclo.faseProgressao?.rir).toBe("RIR 1");

    await config.salvar({ semanaManual: 99 });
    expect(ciclo.semanaAtual).toBe(ciclo.semanasPorCiclo);

    await config.salvar({ semanaManual: 0 });
    expect(ciclo.semanaAtual).toBe(1);

    await config.salvar({ semanaManual: null });
    expect(ciclo.semanaAtual).toBe(1);
  });

  test("escritas seguidas não são revertidas por releitura em voo", async () => {
    // A releitura vem de evento e é assíncrona; sem guarda, a que estava em voo
    // aplicava o valor antigo por cima do novo.
    const { config, ciclo } = await montar();

    await config.salvar({ semanaManual: 3 });
    await config.salvar({ semanaManual: 7 });
    await new Promise((r) => setTimeout(r, 50));

    expect(config.config?.semanaManual).toBe(7);
    expect(ciclo.semanaAtual).toBe(7);
  });
});

describe("avanço de ciclo", () => {
  test("recusa offline, porque a fila resolve por último a chegar", async () => {
    const { ciclo } = await montar();
    const sync = useSyncStore();
    sync.online = false;

    expect(await ciclo.avancarCiclo(UID)).toBe(false);
    expect(ciclo.erro).toMatch(/conex/i);
    expect(ciclo.cicloAtual).toBe(1);
  });

  test("avançar não passa pelo outbox", async () => {
    const { ciclo } = await montar();
    const sync = useSyncStore();
    sync.online = false;

    const antes = await (await import("../../db/outbox.ts")).contarPendentes();
    await ciclo.avancarCiclo(UID);
    const depois = await (await import("../../db/outbox.ts")).contarPendentes();

    expect(depois).toBe(antes);
  });
});

describe("DD-A06 · overrides", () => {
  test("override entra no gerador e muda o slot do ciclo corrente", async () => {
    const { config, ciclo, met } = await montar();
    await repos.aplicarConfigRemota({ ...config.config!, cicloAtual: 2 });
    await config.recarregar(UID);

    const slot = METODOLOGIA_V1.slots.find((s) => s.id === "T1-S2")!;
    const atual = ciclo.ciclo!.porSlot["T1-S2"];
    const escolhido = slot.pool.find((id) => id !== atual)!;

    await ciclo.definirOverride(UID, "T1-S2", escolhido);

    expect(met.overrides[2]?.["T1-S2"]).toBe(escolhido);
    expect(ciclo.ciclo!.porSlot["T1-S2"]).toBe(escolhido);
  });

  test("remover override devolve a escolha ao gerador", async () => {
    const { config, ciclo } = await montar();
    await repos.aplicarConfigRemota({ ...config.config!, cicloAtual: 2 });
    await config.recarregar(UID);

    const original = ciclo.ciclo!.porSlot["T1-S2"];
    const slot = METODOLOGIA_V1.slots.find((s) => s.id === "T1-S2")!;
    await ciclo.definirOverride(UID, "T1-S2", slot.pool.find((id) => id !== original)!);
    await ciclo.removerOverride(UID, "T1-S2");

    expect(ciclo.ciclo!.porSlot["T1-S2"]).toBe(original);
  });
});
