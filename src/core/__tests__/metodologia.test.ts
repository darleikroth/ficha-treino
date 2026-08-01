/**
 * Round-trip RTDB (DD-A04).
 *
 * O RTDB não guarda arrays e não garante ordem de chaves, mas a ordem dos slots é
 * semântica: DD-06 exige que T1..T3 estejam resolvidos antes de T4/T5, e DD-05
 * depende da ordem intra-treino. Se `deRtdb()` deixar de reordenar, o ciclo gerado
 * a partir do RTDB diverge do gerado a partir do bundle — e o app passa a mostrar
 * um treino diferente do que o CLI mostra.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { criarGerador } from "../gerador.ts";
import { METODOLOGIA_V1, paraRtdb, deRtdb } from "../metodologia.ts";

/** Reinsere as chaves em ordem inversa, simulando ordem arbitrária do RTDB. */
function embaralhar<T>(mapa: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(mapa).reverse());
}

test("paraRtdb converte arrays em mapas indexados", () => {
  const raw = paraRtdb(METODOLOGIA_V1);

  assert.ok(!Array.isArray(raw.slots), "slots viraram array");
  assert.ok(!Array.isArray(raw.treinos), "treinos viraram array");
  assert.ok(!Array.isArray(raw.progressao), "progressao virou array");

  assert.deepEqual(Object.keys(raw.slots).sort(), METODOLOGIA_V1.slots.map((s) => s.id).sort());
  assert.deepEqual(Object.keys(raw.treinos).sort(), METODOLOGIA_V1.treinos.map((t) => t.id).sort());
  assert.equal(Object.keys(raw.progressao).length, METODOLOGIA_V1.progressao.length);
});

test("deRtdb reconstrói a metodologia sem perda", () => {
  const volta = deRtdb(paraRtdb(METODOLOGIA_V1));

  assert.equal(volta.versao, METODOLOGIA_V1.versao);
  assert.equal(volta.semanasPorCiclo, METODOLOGIA_V1.semanasPorCiclo);
  assert.deepEqual(volta.exercicios, METODOLOGIA_V1.exercicios);
  assert.deepEqual(volta.ciclo1, METODOLOGIA_V1.ciclo1);
  assert.deepEqual(volta.progressao, METODOLOGIA_V1.progressao);
  assert.deepEqual(volta.treinos, METODOLOGIA_V1.treinos);
  assert.deepEqual(volta.slots, METODOLOGIA_V1.slots);
});

test("deRtdb restaura a ordem dos slots mesmo com chaves embaralhadas", () => {
  const raw = paraRtdb(METODOLOGIA_V1);
  const bagunçado = { ...raw, slots: embaralhar(raw.slots), treinos: raw.treinos };

  const volta = deRtdb(bagunçado);
  assert.deepEqual(
    volta.slots.map((s) => s.id),
    METODOLOGIA_V1.slots.map((s) => s.id),
    "ordem dos slots não foi restaurada",
  );
});

test("ciclos gerados a partir do RTDB são idênticos aos do bundle", () => {
  const raw = paraRtdb(METODOLOGIA_V1);
  const doRtdb = criarGerador(deRtdb({ ...raw, slots: embaralhar(raw.slots) }));
  const doBundle = criarGerador(METODOLOGIA_V1);

  for (let n = 1; n <= 12; n++) {
    assert.deepEqual(doRtdb.gerarCiclo(n).porSlot, doBundle.gerarCiclo(n).porSlot, `ciclo ${n} divergiu`);
  }

  assert.deepEqual(doRtdb.validarCatalogo(), []);
  assert.deepEqual(doRtdb.validarSequencia(12), []);
  assert.deepEqual(doRtdb.volumeSemanal(), doBundle.volumeSemanal());
});

test("deRtdb tolera nó incompleto sem lançar", () => {
  const vazio = deRtdb({ versao: "v1" });

  assert.equal(vazio.versao, "v1");
  assert.equal(vazio.semanasPorCiclo, 9, "deveria cair no padrão");
  assert.deepEqual(vazio.slots, []);
  assert.deepEqual(vazio.treinos, []);
  assert.deepEqual(vazio.exercicios, {});
  assert.deepEqual(vazio.progressao, []);
});
