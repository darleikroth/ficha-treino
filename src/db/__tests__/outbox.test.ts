import { afterEach, describe, expect, test } from "vitest";

import { MAX_TENTATIVAS, type OpOutbox } from "../esquema.ts";
import * as outbox from "../outbox.ts";
import { recarregarPagina, zerarBd } from "../../testes/bd.ts";

afterEach(zerarBd);

const enfileirarTodas = async (...paths: string[]) => {
  for (const path of paths) await outbox.enfileirarAgora({ path, op: "set", payload: { path } });
};

const travar = async (id: number) => {
  for (let i = 0; i < MAX_TENTATIVAS; i++) await outbox.registrarFalha(id, new Error("permissão negada"));
};

describe("ordem", () => {
  test("preserva a ordem de inserção — é o que sustenta a causalidade", async () => {
    // Criar sessão antes de adicionar série a ela: inverter isso escreveria
    // numa sessão que ainda não existe no RTDB.
    await enfileirarTodas("/usuarios/u1/sessoes/s1", "/usuarios/u1/sessoes/s1/series/T1-S1/0");

    const fila = await outbox.proximasPendentes();
    expect(fila.map((op) => op.path)).toEqual([
      "/usuarios/u1/sessoes/s1",
      "/usuarios/u1/sessoes/s1/series/T1-S1/0",
    ]);
    expect(fila[0].id).toBeLessThan(fila[1].id!);
  });

  test("respeita o limite pedido", async () => {
    await enfileirarTodas("/a", "/b", "/c");
    expect((await outbox.proximasPendentes(2)).map((o) => o.path)).toEqual(["/a", "/b"]);
  });

  test("uma operação nasce pendente, sem tentativa e sem erro", async () => {
    await enfileirarTodas("/a");
    const [op] = await outbox.proximasPendentes();

    expect(op).toMatchObject({ op: "set", estado: "pendente", tentativas: 0 });
    expect(op.ultimoErro).toBeUndefined();
    expect(op.criadoEm).toBeGreaterThan(0);
  });

  test("remove não carrega payload", async () => {
    await outbox.enfileirarAgora({ path: "/a", op: "remove", payload: { ignorado: true } });
    const [op] = await outbox.proximasPendentes();
    expect(op.payload).toBeNull();
  });
});

describe("falha e travamento", () => {
  test("cada falha incrementa a tentativa e guarda o motivo", async () => {
    await enfileirarTodas("/a");
    const [op] = await outbox.proximasPendentes();

    const depois = await outbox.registrarFalha(op.id!, new Error("rede caiu"));
    expect(depois).toMatchObject({ tentativas: 1, estado: "pendente", ultimoErro: "rede caiu" });
  });

  test(`trava em ${MAX_TENTATIVAS} tentativas em vez de tentar para sempre`, async () => {
    await enfileirarTodas("/a");
    const [op] = await outbox.proximasPendentes();
    await travar(op.id!);

    const [presa] = await outbox.travadas();
    expect(presa).toMatchObject({ estado: "travada", tentativas: MAX_TENTATIVAS });
  });

  test("a drenagem para na primeira travada, não pula por cima dela", async () => {
    await enfileirarTodas("/primeira", "/segunda", "/terceira");
    const todas = await outbox.todas();
    await travar(todas[1].id!);

    // /terceira pode depender de /segunda. Pular para "adiantar" a fila
    // aplicaria escritas cuja precondição nunca chegou ao servidor.
    expect((await outbox.proximasPendentes()).map((o) => o.path)).toEqual(["/primeira"]);
  });

  test("destravar devolve tudo para a fila zerando as tentativas", async () => {
    await enfileirarTodas("/a", "/b");
    const todas = await outbox.todas();
    await travar(todas[0].id!);

    expect(await outbox.destravar()).toBe(1);

    const fila = await outbox.proximasPendentes();
    expect(fila.map((o) => o.path)).toEqual(["/a", "/b"]);
    expect(fila[0]).toMatchObject({ tentativas: 0, estado: "pendente" });
    expect(fila[0].ultimoErro).toBeUndefined();
  });

  test("registrarFalha em id inexistente devolve undefined em vez de lançar", async () => {
    expect(await outbox.registrarFalha(9999, new Error("x"))).toBeUndefined();
  });
});

describe("backoff", () => {
  test("dobra de 1s até o teto de 60s", () => {
    expect(outbox.esperaDeBackoff(1)).toBe(1_000);
    expect(outbox.esperaDeBackoff(2)).toBe(2_000);
    expect(outbox.esperaDeBackoff(3)).toBe(4_000);
    expect(outbox.esperaDeBackoff(7)).toBe(60_000);
    expect(outbox.esperaDeBackoff(MAX_TENTATIVAS)).toBe(60_000);
  });

  test("tolera tentativa zero", () => {
    expect(outbox.esperaDeBackoff(0)).toBe(1_000);
  });
});

describe("conclusão e persistência", () => {
  test("concluir tira a operação da fila", async () => {
    await enfileirarTodas("/a", "/b");
    const [primeira] = await outbox.proximasPendentes();

    await outbox.concluir(primeira.id!);

    expect((await outbox.todas()).map((o) => o.path)).toEqual(["/b"]);
    expect(await outbox.contarPendentes()).toBe(1);
  });

  test("a fila sobrevive a reload da página, com ordem e estado", async () => {
    await enfileirarTodas("/a", "/b", "/c");
    const todas = await outbox.todas();
    await travar(todas[2].id!);

    await recarregarPagina();

    const depois: OpOutbox[] = await outbox.todas();
    expect(depois.map((o) => o.path)).toEqual(["/a", "/b", "/c"]);
    expect(depois[2]).toMatchObject({ estado: "travada", tentativas: MAX_TENTATIVAS });
    expect(await outbox.contarPendentes()).toBe(3);
  });
});
