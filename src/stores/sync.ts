import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

import { aoMudar } from "../db/eventos.ts";
import type { OpOutbox } from "../db/esquema.ts";
import * as outbox from "../db/outbox.ts";
import * as repos from "../db/repos.ts";
import { observarConexao } from "../firebase/conexao.ts";
import { drenar as drenarOutbox, escutar, type EscutaAtiva } from "../firebase/sync.ts";

/**
 * Estado de sincronização.
 *
 * A UI não espera por nada disto para registrar série: o commit é local. Esta
 * store existe para *mostrar* o que ainda não subiu, e para disparar a drenagem
 * nos três momentos que importam — ao conectar, no boot e depois de cada
 * escrita local.
 */
export const useSyncStore = defineStore("sync", () => {
  const online = ref(false);
  const pendentes = ref(0);
  const travadas = shallowRef<OpOutbox[]>([]);
  const ultimoSyncEm = ref<number | null>(null);
  const drenando = ref(false);
  const erro = ref<string | null>(null);

  let escuta: EscutaAtiva | null = null;
  let cancelarConexao: (() => void) | null = null;
  let cancelarEventos: (() => void) | null = null;
  let agendado: ReturnType<typeof setTimeout> | null = null;
  let ativo = false;

  async function atualizarContadores(): Promise<void> {
    pendentes.value = await outbox.contarPendentes();
    travadas.value = await outbox.travadas();
    ultimoSyncEm.value = (await repos.lerUltimoSyncEm()) ?? null;
  }

  function agendarNovaTentativa(esperaMs: number): void {
    if (agendado) clearTimeout(agendado);
    agendado = setTimeout(() => {
      agendado = null;
      if (online.value) void drenar();
    }, esperaMs);
  }

  async function drenar(): Promise<void> {
    if (!ativo || drenando.value || !online.value) return;

    drenando.value = true;
    try {
      const resultado = await drenarOutbox();
      erro.value = resultado.falhou ? (resultado.erro ?? "Falha ao sincronizar.") : null;

      if (resultado.falhou && !resultado.travou) agendarNovaTentativa(resultado.esperaMs);
    } catch (e) {
      erro.value = e instanceof Error ? e.message : String(e);
    } finally {
      drenando.value = false;
      await atualizarContadores();
    }
  }

  function iniciar(uid: string, versaoMetodologia: string): void {
    if (ativo) return;
    ativo = true;

    void atualizarContadores();

    // Toda escrita local passa pelo outbox; recontar aqui mantém o indicador
    // honesto sem a UI precisar avisar ninguém.
    cancelarEventos = aoMudar(() => {
      void atualizarContadores().then(() => {
        if (online.value && pendentes.value > 0) void drenar();
      });
    });

    cancelarConexao = observarConexao((conectado) => {
      online.value = conectado;
      if (conectado) void drenar();
    });

    escuta = escutar(uid, versaoMetodologia);
  }

  function parar(): void {
    ativo = false;
    if (agendado) clearTimeout(agendado);
    agendado = null;
    escuta?.encerrar();
    escuta = null;
    cancelarConexao?.();
    cancelarConexao = null;
    cancelarEventos?.();
    cancelarEventos = null;
  }

  /** Ação manual do IndicadorSync quando uma operação travou. */
  async function destravar(): Promise<void> {
    await outbox.destravar();
    await atualizarContadores();
    void drenar();
  }

  return {
    online,
    pendentes,
    travadas,
    ultimoSyncEm,
    drenando,
    erro,
    iniciar,
    parar,
    drenar,
    destravar,
    atualizarContadores,
  };
});
