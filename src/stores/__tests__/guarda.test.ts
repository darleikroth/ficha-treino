/**
 * Guard de rota (DD-A12).
 *
 * O que estes testes travam é a ordem, não o destino final: se o guard decidir
 * antes de `onAuthStateChanged` resolver, o app redireciona para `/login` a
 * cada abertura offline. O URL final não denuncia isso — a tela de login
 * rebate para o destino assim que a sessão aparece — então o flash só é
 * detectável olhando o momento da decisão.
 */

import { describe, expect, test } from "vitest";
import { reactive } from "vue";

import { aguardarResolucao, decidirRota, type EstadoSessao } from "../../router/guarda.ts";

const sessao = (parcial: Partial<EstadoSessao> = {}): EstadoSessao =>
  reactive({ carregando: true, autenticado: false, ...parcial });

const rota = (fullPath: string, publica = false) => ({ fullPath, meta: { publica } });

describe("aguardarResolucao", () => {
  test("resolve na hora quando a sessão já foi resolvida", async () => {
    let resolveu = false;
    void aguardarResolucao(sessao({ carregando: false })).then(() => (resolveu = true));

    await Promise.resolve();
    expect(resolveu).toBe(true);
  });

  test("não resolve enquanto carregando — é o que evita o flash de /login", async () => {
    const s = sessao({ carregando: true });
    let resolveu = false;
    void aguardarResolucao(s).then(() => (resolveu = true));

    // Várias voltas do event loop: se não esperasse, já teria resolvido.
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 10));
    expect(resolveu).toBe(false);

    s.carregando = false;
    await new Promise((r) => setTimeout(r, 10));
    expect(resolveu).toBe(true);
  });

  test("a decisão só acontece depois da resolução", async () => {
    const s = sessao({ carregando: true, autenticado: false });
    const ordem: string[] = [];

    const guard = (async () => {
      await aguardarResolucao(s);
      ordem.push("decidiu");
      return decidirRota(s, rota("/ciclo"));
    })();

    await new Promise((r) => setTimeout(r, 10));
    expect(ordem).toEqual([]);

    // Sessão restaurada da persistência local: autenticado, sem rede.
    ordem.push("sessao-restaurada");
    s.autenticado = true;
    s.carregando = false;

    expect(await guard).toBe(true);
    expect(ordem).toEqual(["sessao-restaurada", "decidiu"]);
  });
});

describe("decidirRota", () => {
  test("autenticado passa em rota protegida", () => {
    expect(decidirRota(sessao({ carregando: false, autenticado: true }), rota("/ciclo"))).toBe(true);
  });

  test("autenticado é tirado da tela de login", () => {
    const decisao = decidirRota(
      sessao({ carregando: false, autenticado: true }),
      rota("/login", true),
    );
    expect(decisao).toEqual({ name: "home" });
  });

  test("anônimo vai para o login guardando o destino", () => {
    const decisao = decidirRota(sessao({ carregando: false }), rota("/treino/T1"));
    expect(decisao).toEqual({ name: "login", query: { redirecionar: "/treino/T1" } });
  });

  test("anônimo entra em rota pública", () => {
    expect(decidirRota(sessao({ carregando: false }), rota("/login", true))).toBe(true);
  });
});
