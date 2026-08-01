/**
 * Integridade do catálogo e da estrutura de slots.
 *
 * Estes testes travam a parte INVARIANTE do sistema (DD-02): se o volume semanal
 * ou a contagem de slots mudar sem bump de versão da metodologia, quebra aqui.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { criarGerador } from "../gerador.ts";
import { METODOLOGIA_V1 } from "../metodologia.ts";

const g = criarGerador(METODOLOGIA_V1);
const m = METODOLOGIA_V1;

test("catálogo não tem erro de integridade", () => {
  assert.deepEqual(g.validarCatalogo(), []);
});

test("a metodologia tem o tamanho esperado", () => {
  assert.equal(Object.keys(m.exercicios).length, 127, "exercícios no catálogo");
  assert.equal(m.slots.length, 40, "slots");
  assert.equal(m.treinos.length, 5, "treinos");
  assert.equal(m.progressao.length, 4, "fases de progressão");
  assert.equal(m.semanasPorCiclo, 9);
  assert.equal(m.versao, "v1");
});

test("todo slot tem entrada no Ciclo 1 e ela pertence ao pool", () => {
  assert.equal(Object.keys(m.ciclo1).length, m.slots.length);
  for (const slot of m.slots) {
    const id = m.ciclo1[slot.id];
    assert.ok(id, `${slot.id}: sem entrada no ciclo1`);
    assert.ok(slot.pool.includes(id), `${slot.id}: "${id}" fora do pool`);
  }
});

test("todo id de pool existe no catálogo e não há duplicata", () => {
  for (const slot of m.slots) {
    assert.equal(new Set(slot.pool).size, slot.pool.length, `${slot.id}: pool com duplicata`);
    for (const id of slot.pool) {
      assert.ok(m.exercicios[id], `${slot.id}: id inexistente "${id}"`);
    }
  }
});

test("slot não-âncora tem pool suficiente para cooldown + família", () => {
  for (const slot of m.slots) {
    if (slot.ancora) continue;
    assert.ok(
      slot.pool.length >= 3,
      `${slot.id}: pool de ${slot.pool.length} — cooldown + família podem travar`,
    );
  }
});

test("familiaDistintaDe aponta só para slots existentes", () => {
  const ids = new Set(m.slots.map((s) => s.id));
  for (const slot of m.slots) {
    for (const alvo of slot.familiaDistintaDe ?? []) {
      assert.ok(ids.has(alvo), `${slot.id}: familiaDistintaDe aponta para "${alvo}", que não existe`);
    }
  }
});

test("DD-02 · volume semanal é o esperado e não depende do ciclo", () => {
  const esperado = {
    peito: 17,
    ombroAnterior: 3,
    ombroLateral: 8,
    triceps: 9,
    costas: 20,
    ombroPosterior: 6,
    biceps: 9,
    quadriceps: 14,
    gluteo: 9,
    adutores: 3,
    panturrilha: 14,
    isquios: 8,
    lombar: 3,
  };
  assert.deepEqual(g.volumeSemanal(), esperado);

  // A rotação troca qual exercício ocupa o slot, nunca quantas séries ele tem.
  for (const n of [1, 2, 3, 7, 12]) {
    assert.deepEqual(g.gerarCiclo(n).volume, esperado, `volume mudou no ciclo ${n}`);
  }
});

test("séries e reps de slot são idênticos em todos os ciclos", () => {
  const assinatura = (n: number) =>
    g
      .gerarCiclo(n)
      .treinos.flatMap((t) => t.itens.map((i) => `${i.slot.id}:${i.slot.series}x${i.slot.reps}`))
      .join("|");

  const base = assinatura(1);
  for (const n of [2, 3, 5, 9, 12]) {
    assert.equal(assinatura(n), base, `estrutura de séries/reps mudou no ciclo ${n}`);
  }
});
