/**
 * Regras de rotação: DD-03 (âncoras), DD-04 (cooldown), DD-05/DD-06 (família).
 *
 * O teste de DD-04 é deliberadamente redundante: além de chamar
 * `validarSequencia(12)`, ele rededuz a regra a partir de `porSlot`. Foi um
 * off-by-one no cooldown que passou despercebido porque a única validação
 * existente (`validar()`) inspeciona um ciclo isolado e é estruturalmente cega
 * a propriedades entre ciclos — não convém que a suíte dependa de um único
 * validador para a mesma classe de erro.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { criarGerador } from "../gerador.ts";
import { METODOLOGIA_V1 } from "../metodologia.ts";

const ATE = 12;
const m = METODOLOGIA_V1;
const g = criarGerador(m);
const ciclos = Array.from({ length: ATE }, (_, i) => g.gerarCiclo(i + 1));
const naoAncoras = m.slots.filter((s) => !s.ancora);
const ancoras = m.slots.filter((s) => s.ancora);

test("gerarCiclo é determinístico entre chamadas e entre instâncias", () => {
  const outro = criarGerador(METODOLOGIA_V1);
  for (const n of [1, 2, 3, 7, 12]) {
    assert.deepEqual(g.gerarCiclo(n).porSlot, g.gerarCiclo(n).porSlot, `ciclo ${n}: instável`);
    assert.deepEqual(g.gerarCiclo(n).porSlot, outro.gerarCiclo(n).porSlot, `ciclo ${n}: depende de instância`);
  }
});

test("gerarCiclo rejeita número de ciclo inválido", () => {
  for (const n of [0, -1, 1.5, NaN]) {
    assert.throws(() => g.gerarCiclo(n), /Ciclo inválido/, `aceitou ${n}`);
  }
});

test("Ciclo 1 é o fixado e todo slot é preenchido em todos os ciclos", () => {
  assert.deepEqual(ciclos[0].porSlot, m.ciclo1);
  assert.equal(ciclos[0].fixado, true);

  for (const ciclo of ciclos) {
    for (const slot of m.slots) {
      const id = ciclo.porSlot[slot.id];
      assert.ok(id, `ciclo ${ciclo.numero}: ${slot.id} vazio`);
      assert.ok(slot.pool.includes(id), `ciclo ${ciclo.numero}: ${slot.id} fora do pool`);
    }
  }
});

test("semanaInicial acompanha semanasPorCiclo", () => {
  assert.equal(ciclos[0].semanaInicial, 1);
  assert.equal(ciclos[1].semanaInicial, 1 + m.semanasPorCiclo);
  assert.equal(ciclos[11].semanaInicial, 11 * m.semanasPorCiclo + 1);
});

test("DD-03/DD-04 · validarSequencia(12) sem problemas", () => {
  assert.deepEqual(g.validarSequencia(ATE), []);
});

test("DD-04 · repetição N→N+1 só ocorre com aviso de cooldown", () => {
  const semAviso: string[] = [];
  const comAviso: string[] = [];

  for (let i = 1; i < ATE; i++) {
    const ant = ciclos[i - 1];
    const atu = ciclos[i];
    for (const slot of naoAncoras) {
      if (ant.porSlot[slot.id] !== atu.porSlot[slot.id]) continue;
      const reportado = atu.avisos.some((a) => a.includes(slot.id) && a.includes("cooldown"));
      (reportado ? comAviso : semAviso).push(`C${i}→C${i + 1} ${slot.id}`);
    }
  }

  assert.deepEqual(semAviso, [], "repetição silenciosa de cooldown");

  // As 2 residuais são estruturais em T4-S1: 4 exercícios em 3 famílias, duas
  // colidindo com T1-S1/T1-S2 via DD-06. Relaxar e avisar é o comportamento
  // correto. Se este número mudar, algo no pool ou nas regras mudou junto.
  assert.equal(comAviso.length, 2, `relaxamentos de cooldown: ${comAviso.join(", ")}`);
  assert.ok(
    comAviso.every((x) => x.endsWith("T4-S1")),
    `relaxamento fora de T4-S1: ${comAviso.join(", ")}`,
  );
});

test("DD-03 · âncora troca exatamente a cada 2 ciclos", () => {
  for (const slot of ancoras) {
    if (slot.pool.length <= 1) continue;
    for (let i = 1; i < ATE; i++) {
      const mudou = ciclos[i - 1].porSlot[slot.id] !== ciclos[i].porSlot[slot.id];
      const deveriaMudar = Math.floor(i / 2) !== Math.floor((i - 1) / 2);
      assert.equal(
        mudou,
        deveriaMudar,
        `âncora ${slot.id} entre os ciclos ${i} e ${i + 1}: mudou=${mudou}, esperado=${deveriaMudar}`,
      );
    }
  }
});

test("DD-05/DD-06 · o Ciclo 1 carrega as colisões da ficha real; os gerados, nenhuma", () => {
  // O Ciclo 1 não é escolha do gerador: é a ficha que já estava em uso, fixada
  // como base de cooldown (DD-11). Ela colide em 4 slots de T4/T5 — que é
  // exatamente o problema que a rotação existe para resolver. Por isso o CLI
  // suprime os avisos do ciclo fixado em vez de contá-los como violação.
  const colisoes = g
    .validar(ciclos[0].porSlot)
    .map((aviso) => aviso.split(":")[1].trim().split(" ")[0])
    .sort();
  assert.deepEqual(colisoes, ["T4-S2", "T4-S5", "T4-S7", "T5-S4"]);

  for (const ciclo of ciclos.slice(1)) {
    assert.deepEqual(g.validar(ciclo.porSlot), [], `ciclo ${ciclo.numero}`);
  }
});

test("DD-05 · redução independente: família única por treino", () => {
  for (const ciclo of ciclos) {
    for (const treino of m.treinos) {
      const vistas = new Map<string, string>();
      for (const slot of m.slots.filter((s) => s.treino === treino.id && !s.opcional)) {
        const familia = m.exercicios[ciclo.porSlot[slot.id]].familia;
        const anterior = vistas.get(familia);
        assert.equal(
          anterior,
          undefined,
          `ciclo ${ciclo.numero} ${treino.id}: ${slot.id} e ${anterior} compartilham a família "${familia}"`,
        );
        vistas.set(familia, slot.id);
      }
    }
  }
});

test("DD-06 · redução independente: slots vinculados têm famílias distintas", () => {
  // A partir do Ciclo 2 — o Ciclo 1 é a ficha fixada e colide de propósito.
  for (const ciclo of ciclos.slice(1)) {
    for (const slot of m.slots) {
      for (const outro of slot.familiaDistintaDe ?? []) {
        const a = m.exercicios[ciclo.porSlot[slot.id]];
        const b = m.exercicios[ciclo.porSlot[outro]];
        assert.notEqual(
          a.familia,
          b.familia,
          `ciclo ${ciclo.numero}: ${slot.id} (${a.nome}) e ${outro} (${b.nome}) na família "${a.familia}"`,
        );
      }
    }
  }
});

test("indisponiveis é filtro duro enquanto sobrar opção no pool", () => {
  const alvo = m.slots.find((s) => !s.ancora && s.pool.length >= 4)!;
  const banidos = alvo.pool.slice(0, 2);
  const gf = criarGerador(m, { indisponiveis: banidos });

  for (let n = 2; n <= ATE; n++) {
    const escolhido = gf.gerarCiclo(n).porSlot[alvo.id];
    assert.ok(
      !banidos.includes(escolhido),
      `ciclo ${n}: ${alvo.id} escolheu "${escolhido}", que está indisponível`,
    );
  }

  // Indisponibilidade parcial é reportada como restrição relaxada.
  assert.ok(
    gf.gerarCiclo(3).avisos.some((a) => a.includes(alvo.id) && a.includes("equipamento")),
    "filtrou o pool sem avisar",
  );
});

test("pool inteiro indisponível não esvazia o slot", () => {
  const alvo = m.slots.find((s) => !s.ancora)!;
  const gf = criarGerador(m, { indisponiveis: [...alvo.pool] });
  const ciclo = gf.gerarCiclo(3);

  assert.ok(alvo.pool.includes(ciclo.porSlot[alvo.id]), "slot ficou sem exercício");

  // Degradação silenciosa, hoje: com o pool INTEIRO indisponível,
  // `poolDisponivel()` devolve o pool original, o tamanho volta a bater e o
  // aviso de "equipamento indisponível" não dispara — ao contrário do caso
  // parcial. O contrato garantido no momento é apenas não deixar o slot vazio.
  // Se isso virar aviso, troque esta asserção pela do caso parcial.
  assert.deepEqual(
    ciclo.avisos.filter((a) => a.includes(alvo.id)),
    [],
    "o comportamento mudou: agora avisa quando o pool inteiro está indisponível",
  );
});

test("DD-A06 · ciclosFixos sobrepõe a escolha e entra na cadeia de cooldown", () => {
  const alvo = m.slots.find((s) => !s.ancora && s.pool.length >= 4)!;
  const forcado = m.slots.length > 0 ? alvo.pool[alvo.pool.length - 1] : "";
  const gf = criarGerador(m, { ciclosFixos: { 3: { [alvo.id]: forcado } } });

  assert.equal(gf.gerarCiclo(3).porSlot[alvo.id], forcado, "override ignorado");
  assert.equal(gf.gerarCiclo(3).fixado, true);

  // O override precisa participar do cooldown, ou o ciclo seguinte pode repeti-lo.
  assert.notEqual(gf.gerarCiclo(4).porSlot[alvo.id], forcado, "ciclo 4 repetiu o override");
});

test("cobertura do catálogo em 12 ciclos", () => {
  const usados = new Set(ciclos.flatMap((c) => Object.values(c.porSlot)));
  const noPool = new Set(m.slots.flatMap((s) => s.pool));
  assert.equal(noPool.size, 127);
  assert.equal(usados.size, 126, "cobertura mudou — a rotação deixou de visitar o pool como antes");
});
