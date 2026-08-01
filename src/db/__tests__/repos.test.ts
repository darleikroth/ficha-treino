import { afterEach, describe, expect, test } from "vitest";

import { MARCA_TS_SERVIDOR, type Carga, type Config, type Serie, type Sessao } from "../esquema.ts";
import * as outbox from "../outbox.ts";
import * as repos from "../repos.ts";
import { recarregarPagina, zerarBd } from "../../testes/bd.ts";

afterEach(zerarBd);

const UID = "uid-teste";

function novaSessao(sobrepor: Partial<Sessao> = {}): Sessao {
  return {
    id: repos.novoIdSessao(1_700_000_000_000),
    uid: UID,
    treinoId: "T1",
    ciclo: 2,
    semana: 3,
    metodologiaVersao: "v1",
    geradorVersao: "g1",
    status: "ativa",
    inicioEm: 1_700_000_000_000,
    fimEm: null,
    series: {},
    ...sobrepor,
  };
}

const serie = (sobrepor: Partial<Serie> = {}): Serie => ({
  exercicioId: "supino-reto-barra",
  exercicioNome: "Supino Reto com Barra",
  peso: 60,
  reps: 10,
  rir: 2,
  concluidaEm: 1_700_000_100_000,
  ...sobrepor,
});

const carga = (sobrepor: Partial<Carga> = {}): Carga => ({
  peso: 60,
  reps: 10,
  bateuTopo: true,
  atualizadoEm: 1_700_000_100_000,
  ...sobrepor,
});

const config = (sobrepor: Partial<Config> = {}): Config => ({
  uid: UID,
  metodologiaVersao: "v1",
  geradorVersao: "g1",
  cicloAtual: 2,
  semanaManual: null,
  incrementoPadrao: 2.5,
  unidade: "kg",
  indisponiveis: {},
  atualizadoEm: 0,
  ...sobrepor,
});

describe("sessões", () => {
  test("criar grava local e enfileira uma escrita para o RTDB", async () => {
    const sessao = novaSessao();
    await repos.criarSessao(sessao);

    expect(await repos.lerSessao(sessao.id)).toEqual(sessao);

    const [op] = await outbox.proximasPendentes();
    expect(op).toMatchObject({ op: "set", path: `/usuarios/${UID}/sessoes/${sessao.id}` });
    // id e uid ficam implícitos no path e não se duplicam no payload.
    expect(op.payload).not.toHaveProperty("id");
    expect(op.payload).not.toHaveProperty("uid");
  });

  test("DD-A07 · sessaoAtiva devolve a mais recente do usuário", async () => {
    await repos.criarSessao(novaSessao({ id: "1700000000000-aaaa", inicioEm: 1 }));
    await repos.criarSessao(novaSessao({ id: "1700000000001-bbbb", inicioEm: 2 }));
    await repos.criarSessao(novaSessao({ id: "1700000000002-cccc", status: "concluida" }));
    await repos.criarSessao(novaSessao({ id: "1700000000003-dddd", uid: "outro" }));

    expect((await repos.sessaoAtiva(UID))?.id).toBe("1700000000001-bbbb");
  });

  test("sessoesRecentes ordena por id decrescente e não vaza outro uid", async () => {
    await repos.criarSessao(novaSessao({ id: "1700000000000-aaaa" }));
    await repos.criarSessao(novaSessao({ id: "1700000000002-cccc" }));
    await repos.criarSessao(novaSessao({ id: "1700000000001-bbbb" }));
    await repos.criarSessao(novaSessao({ id: "1700000000009-zzzz", uid: "outro" }));

    const recentes = await repos.sessoesRecentes(UID);
    expect(recentes.map((s) => s.id)).toEqual([
      "1700000000002-cccc",
      "1700000000001-bbbb",
      "1700000000000-aaaa",
    ]);
  });

  test("novoIdSessao ordena por timestamp e não colide", () => {
    expect(repos.novoIdSessao(1_700_000_000_000)).toMatch(/^1700000000000-[0-9a-f]{4}$/);
    expect(repos.novoIdSessao(1) < repos.novoIdSessao(2)).toBe(true);

    const muitos = new Set(Array.from({ length: 500 }, () => repos.novoIdSessao()));
    expect(muitos.size).toBeGreaterThan(400);
  });

  test("definirStatusSessao carimba o fim e enfileira update", async () => {
    const sessao = novaSessao();
    await repos.criarSessao(sessao);

    const concluida = await repos.definirStatusSessao(sessao.id, "concluida");

    expect(concluida.status).toBe("concluida");
    expect(concluida.fimEm).toBeGreaterThan(0);

    const fila = await outbox.proximasPendentes();
    expect(fila.at(-1)).toMatchObject({
      op: "update",
      path: `/usuarios/${UID}/sessoes/${sessao.id}`,
    });
  });

  test("operar em sessão inexistente falha sem sujar o outbox", async () => {
    await expect(repos.registrarSerie("nao-existe", "T1-S1", 0, serie(), carga())).rejects.toThrow(
      /Sessão inexistente/,
    );
    expect(await outbox.contarPendentes()).toBe(0);
  });
});

describe("registro de série", () => {
  test("DD-A10 · grava série e carga no mesmo commit, com duas operações", async () => {
    const sessao = novaSessao();
    await repos.criarSessao(sessao);

    const atualizada = await repos.registrarSerie("" + sessao.id, "T1-S1", 0, serie(), carga());

    expect(atualizada.series["T1-S1"]["0"]).toEqual(serie());
    expect(await repos.lerCarga(UID, "supino-reto-barra")).toMatchObject({ peso: 60, reps: 10 });

    const fila = await outbox.proximasPendentes();
    expect(fila.map((o) => o.path)).toEqual([
      `/usuarios/${UID}/sessoes/${sessao.id}`,
      `/usuarios/${UID}/sessoes/${sessao.id}/series/T1-S1/0`,
      `/usuarios/${UID}/cargas/supino-reto-barra`,
    ]);
  });

  test("DD-A05 · a série persiste o nome literal do exercício", async () => {
    const sessao = novaSessao();
    await repos.criarSessao(sessao);
    await repos.registrarSerie(sessao.id, "T1-S1", 0, serie(), carga());

    const gravada = (await repos.lerSessao(sessao.id))!.series["T1-S1"]["0"];
    expect(gravada.exercicioNome).toBe("Supino Reto com Barra");
    expect(gravada.exercicioId).toBe("supino-reto-barra");
  });

  test("a carga vai ao RTDB com marcador de timestamp do servidor", async () => {
    const sessao = novaSessao();
    await repos.criarSessao(sessao);
    await repos.registrarSerie(sessao.id, "T1-S1", 0, serie(), carga());

    const daCarga = (await outbox.proximasPendentes()).at(-1)!;
    // LWW com o relógio do dispositivo resolveria o conflito ao contrário
    // entre dois celulares com horários diferentes.
    expect(daCarga.payload).toMatchObject({ atualizadoEm: MARCA_TS_SERVIDOR });
  });

  test("séries de slots diferentes convivem sem se sobrescrever", async () => {
    const sessao = novaSessao();
    await repos.criarSessao(sessao);

    await repos.registrarSerie(sessao.id, "T1-S1", 0, serie({ peso: 60 }), carga());
    await repos.registrarSerie(sessao.id, "T1-S1", 1, serie({ peso: 62.5 }), carga({ peso: 62.5 }));
    await repos.registrarSerie(
      sessao.id,
      "T1-S2",
      0,
      serie({ exercicioId: "peck-deck", exercicioNome: "Peck Deck", peso: 40 }),
      carga({ peso: 40 }),
    );

    const { series } = (await repos.lerSessao(sessao.id))!;
    expect(Object.keys(series["T1-S1"])).toEqual(["0", "1"]);
    expect(series["T1-S1"]["1"].peso).toBe(62.5);
    expect(series["T1-S2"]["0"].exercicioNome).toBe("Peck Deck");
  });

  test("desfazer remove a série e enfileira o remove no path exato", async () => {
    const sessao = novaSessao();
    await repos.criarSessao(sessao);
    await repos.registrarSerie(sessao.id, "T1-S1", 0, serie(), carga());
    await repos.registrarSerie(sessao.id, "T1-S1", 1, serie(), carga());

    const depois = await repos.removerSerie(sessao.id, "T1-S1", 1);

    expect(Object.keys(depois.series["T1-S1"])).toEqual(["0"]);
    expect((await outbox.proximasPendentes()).at(-1)).toMatchObject({
      op: "remove",
      path: `/usuarios/${UID}/sessoes/${sessao.id}/series/T1-S1/1`,
    });
  });
});

describe("config e overrides", () => {
  test("gravar config carimba a hora e enfileira update sem repetir o uid", async () => {
    await repos.gravarConfig(config());

    const salva = await repos.lerConfig(UID);
    expect(salva?.cicloAtual).toBe(2);
    expect(salva?.atualizadoEm).toBeGreaterThan(0);

    const [op] = await outbox.proximasPendentes();
    expect(op).toMatchObject({ op: "update", path: `/usuarios/${UID}/config` });
    expect(op.payload).not.toHaveProperty("uid");
    expect(op.payload).toMatchObject({ atualizadoEm: MARCA_TS_SERVIDOR });
  });

  test("DD-A06 · override mescla no ciclo em vez de substituir o mapa", async () => {
    await repos.definirOverride(UID, 3, "T1-S2", "supino-inclinado-barra");
    await repos.definirOverride(UID, 3, "T4-S1", "crucifixo-maquina");

    expect(await repos.lerOverrides(UID, 3)).toEqual({
      "T1-S2": "supino-inclinado-barra",
      "T4-S1": "crucifixo-maquina",
    });

    const fila = await outbox.proximasPendentes();
    expect(fila.map((o) => o.path)).toEqual([
      `/usuarios/${UID}/overrides/3/T1-S2`,
      `/usuarios/${UID}/overrides/3/T4-S1`,
    ]);
    expect(fila[0].payload).toBe("supino-inclinado-barra");
  });

  test("remover override tira só o slot pedido", async () => {
    await repos.definirOverride(UID, 3, "T1-S2", "a");
    await repos.definirOverride(UID, 3, "T4-S1", "b");

    await repos.removerOverride(UID, 3, "T1-S2");

    expect(await repos.lerOverrides(UID, 3)).toEqual({ "T4-S1": "b" });
    expect((await outbox.proximasPendentes()).at(-1)).toMatchObject({ op: "remove" });
  });
});

describe("cargas", () => {
  test("lerCargas devolve mapa por exercício e isola por uid", async () => {
    await repos.aplicarCargaRemota(UID, "supino-reto-barra", carga({ peso: 60 }));
    await repos.aplicarCargaRemota(UID, "peck-deck", carga({ peso: 40 }));
    await repos.aplicarCargaRemota("outro-uid", "supino-reto-barra", carga({ peso: 999 }));

    const mapa = await repos.lerCargas(UID);
    expect(Object.keys(mapa).sort()).toEqual(["peck-deck", "supino-reto-barra"]);
    expect(mapa["supino-reto-barra"].peso).toBe(60);
  });

  test("usuário sem carga registrada devolve mapa vazio", async () => {
    expect(await repos.lerCargas(UID)).toEqual({});
  });
});

describe("escrita vinda do RTDB", () => {
  test("aplicar* grava local sem realimentar o outbox", async () => {
    // Reenfileirar o que acabou de chegar do servidor criaria um laço de sync.
    await repos.aplicarConfigRemota(config({ cicloAtual: 5 }));
    await repos.aplicarSessaoRemota(novaSessao({ id: "1700000000000-rrrr" }));
    await repos.aplicarCargaRemota(UID, "peck-deck", carga());
    await repos.aplicarOverridesRemotos(UID, 4, { "T1-S2": "x" });
    await repos.gravarMetodologia({ versao: "v1" } as never);

    expect(await outbox.contarPendentes()).toBe(0);
    expect((await repos.lerConfig(UID))?.cicloAtual).toBe(5);
    expect(await repos.lerSessao("1700000000000-rrrr")).toBeDefined();
    expect(await repos.lerOverrides(UID, 4)).toEqual({ "T1-S2": "x" });
    expect(await repos.lerMetodologia("v1")).toEqual({ versao: "v1" });
  });
});

describe("checkpoint da Fase 2 · sobrevivência a reload", () => {
  test("sessão em andamento e fila de sync sobrevivem ao F5", async () => {
    const sessao = novaSessao();
    await repos.criarSessao(sessao);
    await repos.registrarSerie(sessao.id, "T1-S1", 0, serie({ peso: 60 }), carga({ peso: 60 }));
    await repos.registrarSerie(sessao.id, "T1-S1", 1, serie({ peso: 62.5 }), carga({ peso: 62.5 }));
    await repos.gravarConfig(config());

    const pendentesAntes = await outbox.contarPendentes();

    await recarregarPagina();

    const viva = await repos.sessaoAtiva(UID);
    expect(viva?.id).toBe(sessao.id);
    expect(Object.keys(viva!.series["T1-S1"])).toEqual(["0", "1"]);
    expect(viva!.series["T1-S1"]["1"].peso).toBe(62.5);

    expect((await repos.lerCargas(UID))["supino-reto-barra"].peso).toBe(62.5);
    expect((await repos.lerConfig(UID))?.cicloAtual).toBe(2);

    // Nada drenou ainda: a fila inteira continua lá, na ordem original.
    expect(await outbox.contarPendentes()).toBe(pendentesAntes);
    const fila = await outbox.proximasPendentes();
    expect(fila[0].path).toBe(`/usuarios/${UID}/sessoes/${sessao.id}`);
    expect(fila.map((o) => o.id)).toEqual([...fila.map((o) => o.id)].sort((a, b) => a! - b!));
  });
});
