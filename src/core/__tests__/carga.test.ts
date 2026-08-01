/**
 * Sugestão de carga (DD-10, DD-A09).
 *
 * O ponto sensível é o parse: `slot.reps` já traz `"6-10 / falha"` na v1, e o
 * contrato manda tratar rótulo sem número como "sem progressão automática" em
 * vez de exceção. Um slot textual não pode derrubar a tela de treino.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { METODOLOGIA_V1 } from "../metodologia.ts";
import {
  bateuTopo,
  e1rm,
  faixaReps,
  faixaSeries,
  seriesAlvo,
  sugerirCarga,
  type Carga,
} from "../progressao.ts";

const carga = (p: Partial<Carga> = {}): Carga => ({
  peso: 60,
  reps: 10,
  bateuTopo: false,
  atualizadoEm: 1,
  ...p,
});

test("faixaReps cobre todos os formatos da metodologia v1", () => {
  for (const slot of METODOLOGIA_V1.slots) {
    assert.notEqual(faixaReps(slot.reps), null, `${slot.id}: reps "${slot.reps}" não parseou`);
  }
});

test("faixaReps entende faixa, sufixo textual e valor único", () => {
  assert.deepEqual(faixaReps("8-12"), [8, 12]);
  assert.deepEqual(faixaReps("6-10 / falha"), [6, 10]);
  assert.deepEqual(faixaReps("15-20"), [15, 20]);
  assert.deepEqual(faixaReps("10 a 12"), [10, 12]);
  assert.deepEqual(faixaReps("8"), [8, 8]);
  assert.deepEqual(faixaReps("12–15"), [12, 15], "travessão");
});

test("faixaReps devolve null em rótulo sem número, sem lançar", () => {
  assert.equal(faixaReps("Até a falha"), null);
  assert.equal(faixaReps(""), null);
  assert.equal(faixaReps(undefined as unknown as string), null);
});

test("faixaSeries e seriesAlvo tratam intervalo", () => {
  assert.deepEqual(faixaSeries("3"), [3, 3]);
  assert.deepEqual(faixaSeries("3-4"), [3, 4]);
  assert.equal(seriesAlvo("3"), 3);
  assert.equal(seriesAlvo("3-4"), 4, "usa o topo, para caber o registro da 4ª");
  assert.equal(seriesAlvo("Até a falha", 3), 3, "cai no padrão");
});

test("todos os slots da v1 têm número de séries determinado", () => {
  for (const slot of METODOLOGIA_V1.slots) {
    assert.ok(seriesAlvo(slot.series) >= 1, `${slot.id}: séries "${slot.series}"`);
  }
});

test("DD-10 · bateuTopo exige todas as séries no topo da faixa", () => {
  const slot = { reps: "8-12" };

  assert.equal(bateuTopo([{ reps: 12 }, { reps: 12 }, { reps: 12 }], slot, 3), true);
  assert.equal(bateuTopo([{ reps: 12 }, { reps: 11 }, { reps: 12 }], slot, 3), false);
  assert.equal(bateuTopo([{ reps: 13 }, { reps: 14 }, { reps: 12 }], slot, 3), true, "acima do topo conta");
});

test("bateuTopo é falso com séries faltando", () => {
  const slot = { reps: "8-12" };
  assert.equal(bateuTopo([{ reps: 12 }, { reps: 12 }], slot, 3), false);
  assert.equal(bateuTopo([], slot, 3), false);
});

test("bateuTopo ignora séries além do alvo", () => {
  const slot = { reps: "8-12" };
  // A 4ª série ruim não anula o alvo de 3 já cumprido.
  assert.equal(bateuTopo([{ reps: 12 }, { reps: 12 }, { reps: 12 }, { reps: 5 }], slot, 3), true);
});

test("slot sem faixa numérica nunca progride sozinho", () => {
  assert.equal(bateuTopo([{ reps: 50 }], { reps: "Até a falha" }, 1), false);
});

test("DD-A09 · sem histórico devolve zero e diz por quê", () => {
  const s = sugerirCarga({ reps: "8-12" }, undefined, 2.5);
  assert.equal(s.fonte, "sem-historico");
  assert.equal(s.peso, 0);
  assert.match(s.motivo, /Primeira vez/);
});

test("DD-A09 · bateu o topo sobe o incremento", () => {
  const s = sugerirCarga({ reps: "8-12" }, carga({ peso: 40, bateuTopo: true }), 2.5);
  assert.equal(s.fonte, "progressao");
  assert.equal(s.peso, 42.5);
  assert.match(s.motivo, /\+2,5 da última/);
});

test("DD-A09 · não bateu o topo repete a carga", () => {
  const s = sugerirCarga({ reps: "8-12" }, carga({ peso: 40, reps: 9, bateuTopo: false }), 2.5);
  assert.equal(s.fonte, "ultima");
  assert.equal(s.peso, 40);
  assert.match(s.motivo, /Mesma carga/);
});

test("slot sem faixa repete a carga mesmo com bateuTopo gravado", () => {
  const s = sugerirCarga({ reps: "Até a falha" }, carga({ peso: 40, bateuTopo: true }), 2.5);
  assert.equal(s.fonte, "ultima");
  assert.equal(s.peso, 40);
});

test("incremento zero não inventa progressão", () => {
  const s = sugerirCarga({ reps: "8-12" }, carga({ peso: 40, bateuTopo: true }), 0);
  assert.equal(s.fonte, "ultima");
  assert.equal(s.peso, 40);
});

test("somar 2,5 repetidas vezes não acumula lixo de ponto flutuante", () => {
  let peso = 0.1;
  for (let i = 0; i < 20; i++) {
    peso = sugerirCarga({ reps: "8-12" }, carga({ peso, bateuTopo: true }), 2.5).peso;
  }
  assert.equal(peso, 50.1);
});

test("e1rm de Epley, só para exibição", () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 10), 133.33);
  assert.equal(e1rm(60, 5), 70);
});

test("e1rm rejeita entrada sem sentido em vez de devolver NaN", () => {
  assert.equal(e1rm(0, 10), 0);
  assert.equal(e1rm(100, 0), 0);
  assert.equal(e1rm(-50, 5), 0);
  assert.equal(e1rm(NaN, 5), 0);
});
