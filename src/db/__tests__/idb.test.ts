import { afterEach, describe, expect, test } from "vitest";

import { VERSAO_BD } from "../esquema.ts";
import { abrirBd, comTransacao, gravar, ler, limparTudo } from "../idb.ts";
import { recarregarPagina, zerarBd } from "../../testes/bd.ts";

afterEach(zerarBd);

describe("abertura e esquema", () => {
  test("cria todos os object stores da ARQUITETURA §5", async () => {
    const bd = await abrirBd();

    expect(bd.version).toBe(VERSAO_BD);
    expect([...bd.objectStoreNames].sort()).toEqual([
      "cargas",
      "config",
      "meta",
      "metodologia",
      "outbox",
      "overrides",
      "sessoes",
    ]);
  });

  test("sessoes tem os índices de consulta", async () => {
    const indices = await comTransacao(["sessoes"], "readonly", (tx) => [
      ...tx.objectStore("sessoes").indexNames,
    ]);
    expect(indices.sort()).toEqual(["porCiclo", "porStatus", "porUid"]);
  });

  test("outbox usa chave autoIncrement — é o que garante ordem de inserção", async () => {
    const store = await comTransacao(["outbox"], "readonly", (tx) => tx.objectStore("outbox"));
    expect(store.autoIncrement).toBe(true);
    expect(store.keyPath).toBe("id");
  });

  test("reabrir devolve a mesma conexão em vez de abrir outra", async () => {
    expect(await abrirBd()).toBe(await abrirBd());
  });
});

describe("transações", () => {
  test("comTransacao só resolve depois do commit", async () => {
    await comTransacao(["meta"], "readwrite", (tx) => gravar(tx, "meta", 42, "resposta"));

    // Transação nova: se resolvesse antes do commit, este valor poderia faltar.
    const lido = await comTransacao(["meta"], "readonly", (tx) => ler<number>(tx, "meta", "resposta"));
    expect(lido).toBe(42);
  });

  test("callback que lança aborta a transação inteira", async () => {
    await expect(
      comTransacao(["meta"], "readwrite", async (tx) => {
        await gravar(tx, "meta", "parcial", "a");
        throw new Error("falhou no meio");
      }),
    ).rejects.toThrow("falhou no meio");

    const lido = await comTransacao(["meta"], "readonly", (tx) => ler(tx, "meta", "a"));
    expect(lido).toBeUndefined();
  });

  test("vários awaits encadeados mantêm a transação viva", async () => {
    await comTransacao(["meta"], "readwrite", async (tx) => {
      await gravar(tx, "meta", 1, "um");
      await gravar(tx, "meta", 2, "dois");
      const um = await ler<number>(tx, "meta", "um");
      await gravar(tx, "meta", (um ?? 0) + 10, "tres");
    });

    const tres = await comTransacao(["meta"], "readonly", (tx) => ler<number>(tx, "meta", "tres"));
    expect(tres).toBe(11);
  });
});

describe("persistência", () => {
  test("o dado sobrevive a reload da página", async () => {
    await comTransacao(["meta"], "readwrite", (tx) => gravar(tx, "meta", "v1", "metodologiaVersao"));

    await recarregarPagina();

    const lido = await comTransacao(["meta"], "readonly", (tx) =>
      ler<string>(tx, "meta", "metodologiaVersao"),
    );
    expect(lido).toBe("v1");
  });

  test("limparTudo esvazia todas as stores", async () => {
    await comTransacao(["meta", "config"], "readwrite", async (tx) => {
      await gravar(tx, "meta", "x", "chave");
      await gravar(tx, "config", { uid: "u1" });
    });

    await limparTudo();

    const [meta, config] = await comTransacao(["meta", "config"], "readonly", async (tx) => [
      await ler(tx, "meta", "chave"),
      await ler(tx, "config", "u1"),
    ]);
    expect(meta).toBeUndefined();
    expect(config).toBeUndefined();
  });
});
