/**
 * Drenagem do outbox.
 *
 * O aplicador é injetado, então a ordem, a parada na falha e o backoff são
 * testáveis sem subir Firebase. O trajeto real até o RTDB é verificado
 * separadamente contra o emulador.
 */

import { afterEach, describe, expect, test } from "vitest";

import { MARCA_TS_SERVIDOR, MAX_TENTATIVAS, type OpOutbox } from "../../db/esquema.ts";
import * as outbox from "../../db/outbox.ts";
import * as repos from "../../db/repos.ts";
import { drenar, resolverMarcadores } from "../sync.ts";
import { zerarBd } from "../../testes/bd.ts";

afterEach(zerarBd);

const enfileirar = async (...paths: string[]) => {
  for (const path of paths) await outbox.enfileirarAgora({ path, op: "set", payload: { path } });
};

/** Aplicador que registra a ordem e pode falhar num path específico. */
function aplicadorFalso(falharEm?: string) {
  const vistos: string[] = [];
  const aplicar = async (op: OpOutbox) => {
    if (op.path === falharEm) throw new Error("PERMISSION_DENIED");
    vistos.push(op.path);
  };
  return { aplicar, vistos };
}

describe("resolverMarcadores", () => {
  test("troca o marcador pelo sentinela do servidor, em profundidade", () => {
    const resolvido = resolverMarcadores({
      peso: 60,
      atualizadoEm: MARCA_TS_SERVIDOR,
      aninhado: { quando: MARCA_TS_SERVIDOR, lista: [MARCA_TS_SERVIDOR, 1] },
    }) as Record<string, any>;

    expect(resolvido.atualizadoEm).toEqual({ ".sv": "timestamp" });
    expect(resolvido.aninhado.quando).toEqual({ ".sv": "timestamp" });
    expect(resolvido.aninhado.lista[0]).toEqual({ ".sv": "timestamp" });
    expect(resolvido.peso).toBe(60);
    expect(resolvido.aninhado.lista[1]).toBe(1);
  });

  test("não mexe no que não é marcador", () => {
    expect(resolverMarcadores(null)).toBeNull();
    expect(resolverMarcadores("texto")).toBe("texto");
    expect(resolverMarcadores(0)).toBe(0);
  });
});

describe("ordem e conclusão", () => {
  test("envia em ordem de inserção e esvazia a fila", async () => {
    await enfileirar("/a", "/b", "/c");
    const { aplicar, vistos } = aplicadorFalso();

    const resultado = await drenar(aplicar);

    expect(vistos).toEqual(["/a", "/b", "/c"]);
    expect(resultado).toMatchObject({ enviadas: 3, falhou: false, travou: false });
    expect(await outbox.contarPendentes()).toBe(0);
  });

  test("carimba ultimoSyncEm só quando algo subiu", async () => {
    expect(await repos.lerUltimoSyncEm()).toBeUndefined();

    await drenar(aplicadorFalso().aplicar);
    expect(await repos.lerUltimoSyncEm()).toBeUndefined();

    await enfileirar("/a");
    await drenar(aplicadorFalso().aplicar);
    expect(await repos.lerUltimoSyncEm()).toBeGreaterThan(0);
  });

  test("fila vazia é no-op", async () => {
    expect(await drenar(aplicadorFalso().aplicar)).toMatchObject({ enviadas: 0, falhou: false });
  });
});

describe("falha", () => {
  test("para na primeira falha em vez de pular a operação", async () => {
    // Seguir em frente aplicaria escritas cuja precondição não chegou ao
    // servidor — a série iria para uma sessão que o RTDB não tem.
    await enfileirar("/sessao", "/serie-0", "/serie-1");
    const { aplicar, vistos } = aplicadorFalso("/serie-0");

    const resultado = await drenar(aplicar);

    expect(vistos).toEqual(["/sessao"]);
    expect(resultado).toMatchObject({ enviadas: 1, falhou: true, travou: false });
    expect(resultado.erro).toContain("PERMISSION_DENIED");

    const restante = await outbox.todas();
    expect(restante.map((o) => o.path)).toEqual(["/serie-0", "/serie-1"]);
    expect(restante[0].tentativas).toBe(1);
  });

  test("o backoff cresce a cada tentativa até o teto", async () => {
    await enfileirar("/a");
    const { aplicar } = aplicadorFalso("/a");

    const esperas: number[] = [];
    for (let i = 0; i < 4; i++) esperas.push((await drenar(aplicar)).esperaMs);

    expect(esperas).toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  test("depois do limite a operação trava e a fila para de andar", async () => {
    await enfileirar("/ruim", "/depois");
    const { aplicar, vistos } = aplicadorFalso("/ruim");

    let ultimo = await drenar(aplicar);
    for (let i = 1; i < MAX_TENTATIVAS; i++) ultimo = await drenar(aplicar);

    expect(ultimo.travou).toBe(true);
    expect(vistos).toEqual([]);
    expect((await outbox.travadas()).map((o) => o.path)).toEqual(["/ruim"]);

    // /depois continua na fila, atrás da travada, sem ter sido aplicada.
    expect(await outbox.contarPendentes()).toBe(2);
    expect(await outbox.proximasPendentes()).toEqual([]);
  });

  test("destravar retoma exatamente de onde parou, na ordem", async () => {
    await enfileirar("/ruim", "/depois");
    const quebrado = aplicadorFalso("/ruim");
    for (let i = 0; i < MAX_TENTATIVAS; i++) await drenar(quebrado.aplicar);

    await outbox.destravar();
    const bom = aplicadorFalso();
    const resultado = await drenar(bom.aplicar);

    expect(bom.vistos).toEqual(["/ruim", "/depois"]);
    expect(resultado.enviadas).toBe(2);
    expect(await outbox.contarPendentes()).toBe(0);
  });
});

describe("concorrência", () => {
  test("duas drenagens simultâneas não reordenam a fila", async () => {
    await enfileirar("/a", "/b", "/c", "/d");

    const vistos: string[] = [];
    const aplicar = async (op: OpOutbox) => {
      vistos.push(op.path);
      await new Promise((r) => setTimeout(r, 5));
    };

    const [primeira, segunda] = await Promise.all([drenar(aplicar), drenar(aplicar)]);

    // A segunda desiste na hora; a primeira leva a fila inteira.
    expect(vistos).toEqual(["/a", "/b", "/c", "/d"]);
    expect(primeira.enviadas + segunda.enviadas).toBe(4);
    expect(Math.min(primeira.enviadas, segunda.enviadas)).toBe(0);
    expect(await outbox.contarPendentes()).toBe(0);
  });
});

describe("integração com os repositórios", () => {
  test("um treino registrado offline sobe na ordem causal", async () => {
    const uid = "uid-sync";
    const sessaoId = repos.novoIdSessao(1_700_000_000_000);

    await repos.criarSessao({
      id: sessaoId,
      uid,
      treinoId: "T1",
      ciclo: 2,
      semana: 3,
      metodologiaVersao: "v1",
      geradorVersao: "g1",
      status: "ativa",
      inicioEm: 1,
      fimEm: null,
      series: {},
    });
    await repos.registrarSerie(
      sessaoId,
      "T1-S1",
      0,
      { exercicioId: "supino", exercicioNome: "Supino", peso: 60, reps: 10, rir: 2, concluidaEm: 2 },
      { peso: 60, reps: 10, bateuTopo: true, atualizadoEm: 2 },
    );
    await repos.definirStatusSessao(sessaoId, "concluida");

    const { aplicar, vistos } = aplicadorFalso();
    await drenar(aplicar);

    // A sessão precisa existir no servidor antes da série que vive dentro dela.
    expect(vistos[0]).toBe(`/usuarios/${uid}/sessoes/${sessaoId}`);
    expect(vistos[1]).toBe(`/usuarios/${uid}/sessoes/${sessaoId}/series/T1-S1/0`);
    expect(vistos[2]).toBe(`/usuarios/${uid}/cargas/supino`);
    expect(vistos[3]).toBe(`/usuarios/${uid}/sessoes/${sessaoId}`);
    expect(await outbox.contarPendentes()).toBe(0);
  });
});
