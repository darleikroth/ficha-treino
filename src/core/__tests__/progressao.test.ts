import test from "node:test";
import assert from "node:assert/strict";

import { METODOLOGIA_V1 } from "../metodologia.ts";
import {
  ehDeload,
  faseDaSemana,
  intervaloDeSemanas,
  semanaDoCiclo,
  SESSOES_POR_SEMANA,
} from "../progressao.ts";

const { progressao, semanasPorCiclo } = METODOLOGIA_V1;

test("DD-A08 · a semana avança a cada 5 sessões concluídas", () => {
  assert.equal(semanaDoCiclo(0, 9), 1);
  assert.equal(semanaDoCiclo(4, 9), 1);
  assert.equal(semanaDoCiclo(5, 9), 2);
  assert.equal(semanaDoCiclo(9, 9), 2);
  assert.equal(semanaDoCiclo(10, 9), 3);
});

test("DD-A08 · a semana satura no fim do ciclo em vez de estourar", () => {
  assert.equal(semanaDoCiclo(40, 9), 9);
  assert.equal(semanaDoCiclo(1000, 9), 9);
});

test("treinar menos vezes na semana não adianta a fase de RIR", () => {
  // Três sessões numa semana mantêm o usuário na semana 1. Derivar de data
  // mandaria treinar em RIR 2 quem ainda está calibrando carga.
  assert.equal(semanaDoCiclo(3, 9), 1);
  assert.equal(faseDaSemana(progressao, semanaDoCiclo(3, 9))?.rir, "RIR 3");
});

test("entrada estranha não quebra o cálculo", () => {
  assert.equal(semanaDoCiclo(-5, 9), 1);
  assert.equal(semanaDoCiclo(2.7, 9), 1);
  assert.equal(semanaDoCiclo(0, 0), 1);
});

test("intervaloDeSemanas entende faixa, valor único e lixo", () => {
  assert.deepEqual(intervaloDeSemanas("1-2"), [1, 2]);
  assert.deepEqual(intervaloDeSemanas("6-8"), [6, 8]);
  assert.deepEqual(intervaloDeSemanas("9"), [9, 9]);
  assert.deepEqual(intervaloDeSemanas(" 3 - 5 "), [3, 5]);
  assert.equal(intervaloDeSemanas("até a falha"), null);
  assert.equal(intervaloDeSemanas(""), null);
});

test("cada semana do ciclo cai em exatamente uma fase", () => {
  for (let semana = 1; semana <= semanasPorCiclo; semana++) {
    const cobrindo = progressao.filter((f) => {
      const intervalo = intervaloDeSemanas(f.semanas);
      return intervalo !== null && semana >= intervalo[0] && semana <= intervalo[1];
    });
    assert.equal(cobrindo.length, 1, `semana ${semana} coberta por ${cobrindo.length} fases`);
  }
});

test("a progressão de RIR segue a metodologia v1", () => {
  assert.equal(faseDaSemana(progressao, 1)?.rir, "RIR 3");
  assert.equal(faseDaSemana(progressao, 2)?.rir, "RIR 3");
  assert.equal(faseDaSemana(progressao, 3)?.rir, "RIR 2");
  assert.equal(faseDaSemana(progressao, 5)?.rir, "RIR 2");
  assert.equal(faseDaSemana(progressao, 6)?.rir, "RIR 1");
  assert.equal(faseDaSemana(progressao, 8)?.rir, "RIR 1");
  assert.equal(faseDaSemana(progressao, 9)?.rir, "Deload");
});

test("fase inexistente devolve null em vez de lançar", () => {
  assert.equal(faseDaSemana(progressao, 99), null);
  assert.equal(faseDaSemana([], 1), null);
  assert.equal(faseDaSemana([{ semanas: "Até a falha", rir: "?", nota: "" }], 1), null);
});

test("o deload é a última semana e só ela", () => {
  for (let semana = 1; semana < semanasPorCiclo; semana++) {
    assert.equal(ehDeload(progressao, semana), false, `semana ${semana}`);
  }
  assert.equal(ehDeload(progressao, semanasPorCiclo), true);
});

test("uma semana equivale aos 5 treinos do ciclo", () => {
  assert.equal(SESSOES_POR_SEMANA, METODOLOGIA_V1.treinos.length);
});
