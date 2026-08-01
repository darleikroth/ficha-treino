/**
 * Regras de segurança do RTDB (ARQUITETURA §3).
 *
 * Exige os emuladores no ar: `npm run emuladores`. Rode com `npm run test:regras`
 * — ficam fora de `npm test` de propósito, para a suíte principal não depender
 * de processo externo.
 */

import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

const EU = "uid-dono";
const OUTRO = "uid-invasor";

let ambiente: RulesTestEnvironment;

beforeAll(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: "fichatreinos",
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: readFileSync("database.rules.json", "utf8"),
    },
  });
});

afterAll(() => ambiente?.cleanup());

beforeEach(async () => {
  await ambiente.clearDatabase();
  // `.validate` de metodologiaVersao consulta /metodologia, então ela precisa existir.
  await ambiente.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref("/metodologia/v1").set({ versao: "v1", semanasPorCiclo: 9 });
  });
});

const comoDono = () => ambiente.authenticatedContext(EU).database();
const comoOutro = () => ambiente.authenticatedContext(OUTRO).database();
const anonimo = () => ambiente.unauthenticatedContext().database();

const configValida = {
  metodologiaVersao: "v1",
  geradorVersao: "g1",
  cicloAtual: 2,
  incrementoPadrao: 2.5,
  unidade: "kg",
};

describe("/metodologia", () => {
  test("usuário autenticado lê", async () => {
    await assertSucceeds(comoDono().ref("/metodologia/v1").get());
  });

  test("anônimo não lê", async () => {
    await assertFails(anonimo().ref("/metodologia/v1").get());
  });

  test("nem o próprio usuário escreve — o nó só é semeado pelo Admin SDK", async () => {
    await assertFails(comoDono().ref("/metodologia/v1/semanasPorCiclo").set(4));
    await assertFails(comoDono().ref("/metodologia/v2").set({ versao: "v2" }));
  });
});

describe("isolamento entre usuários", () => {
  test("o dono lê e escreve o próprio nó", async () => {
    await assertSucceeds(comoDono().ref(`/usuarios/${EU}/config`).set(configValida));
    await assertSucceeds(comoDono().ref(`/usuarios/${EU}`).get());
  });

  test("outro usuário autenticado NÃO lê meus dados", async () => {
    await ambiente.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref(`/usuarios/${EU}/cargas/supino`).set({ peso: 60 });
    });

    await assertFails(comoOutro().ref(`/usuarios/${EU}`).get());
    await assertFails(comoOutro().ref(`/usuarios/${EU}/cargas/supino`).get());
  });

  test("outro usuário autenticado NÃO escreve nos meus dados", async () => {
    await assertFails(comoOutro().ref(`/usuarios/${EU}/config`).set(configValida));
    await assertFails(comoOutro().ref(`/usuarios/${EU}/cargas/supino`).set({ peso: 1 }));
  });

  test("anônimo não toca em nada de usuário", async () => {
    await assertFails(anonimo().ref(`/usuarios/${EU}`).get());
    await assertFails(anonimo().ref(`/usuarios/${EU}/config`).set(configValida));
  });
});

describe("validação de config", () => {
  test("cicloAtual precisa ser número >= 1", async () => {
    const ref = comoDono().ref(`/usuarios/${EU}/config`);
    await assertSucceeds(ref.set({ ...configValida, cicloAtual: 1 }));
    await assertFails(ref.set({ ...configValida, cicloAtual: 0 }));
    await assertFails(ref.set({ ...configValida, cicloAtual: -3 }));
    await assertFails(ref.set({ ...configValida, cicloAtual: "2" }));
  });

  test("metodologiaVersao inexistente é recusada", async () => {
    // Pinar uma versão que não existe seria falha de sync silenciosa,
    // difícil de diagnosticar depois.
    await assertFails(
      comoDono()
        .ref(`/usuarios/${EU}/config`)
        .set({ ...configValida, metodologiaVersao: "v99" }),
    );
  });
});

describe("validação de sessão", () => {
  const caminhoSerie = `/usuarios/${EU}/sessoes/1700000000000-aaaa/series/T1-S1/0`;

  test("status fora do domínio é recusado", async () => {
    const ref = comoDono().ref(`/usuarios/${EU}/sessoes/1700000000000-aaaa/status`);
    for (const valido of ["ativa", "concluida", "descartada"]) {
      await assertSucceeds(ref.set(valido));
    }
    await assertFails(ref.set("pausada"));
    await assertFails(ref.set(""));
  });

  test("peso, reps e rir têm faixa", async () => {
    const serie = { exercicioId: "supino", exercicioNome: "Supino", peso: 60, reps: 10, rir: 2 };
    const ref = comoDono().ref(caminhoSerie);

    await assertSucceeds(ref.set(serie));
    await assertFails(ref.set({ ...serie, peso: -1 }));
    await assertFails(ref.set({ ...serie, peso: 1000 }));
    await assertFails(ref.set({ ...serie, reps: 200 }));
    await assertFails(ref.set({ ...serie, rir: 11 }));
    await assertFails(ref.set({ ...serie, peso: "60" }));
  });

  test("uma série é gravável no path exato, sem read-modify-write", async () => {
    // É o que permite registrar série a série com conexão instável.
    await assertSucceeds(comoDono().ref(`${caminhoSerie}/peso`).set(62.5));
    const lido = await comoDono().ref(`${caminhoSerie}/peso`).get();
    expect(lido.val()).toBe(62.5);
  });
});
