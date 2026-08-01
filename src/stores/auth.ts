import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";

import { entrarComGoogle, mensagemDeErro, observarAuth, sair, type User } from "../firebase/auth.ts";
import { gravarUidAtivo, lerUidAtivo } from "../db/repos.ts";

/**
 * Sessão do usuário.
 *
 * `carregando` começa `true` e só vira `false` quando `onAuthStateChanged`
 * dispara pela primeira vez — o guard de rota espera por isso. Decidir antes
 * faria o app redirecionar para `/login` a cada abertura offline, mesmo com a
 * sessão válida na persistência local (DD-A12).
 */
export const useAuthStore = defineStore("auth", () => {
  const user = shallowRef<User | null>(null);
  const carregando = ref(true);
  const erro = ref<string | null>(null);
  const entrando = ref(false);

  /** Último uid conhecido, mesmo antes do auth resolver. Permite ler o cache local. */
  const uidConhecido = ref<string | null>(null);

  const autenticado = computed(() => user.value !== null);
  const uid = computed(() => user.value?.uid ?? null);

  let cancelar: (() => void) | null = null;

  /** Assina o observador. Idempotente: chamar duas vezes não cria dois listeners. */
  function iniciar(): void {
    if (cancelar) return;

    void lerUidAtivo().then((salvo) => {
      if (salvo && !uidConhecido.value) uidConhecido.value = salvo;
    });

    try {
      cancelar = observarAuth((atual) => {
        user.value = atual;
        carregando.value = false;

        if (atual) {
          uidConhecido.value = atual.uid;
          void gravarUidAtivo(atual.uid);
        }
      });
    } catch (e) {
      // Config ausente ou inválida. Sem isto o guard trava em `carregando` e o
      // app fica numa tela branca sem dizer o que houve.
      erro.value = mensagemDeErro(e);
      carregando.value = false;
    }
  }

  function parar(): void {
    cancelar?.();
    cancelar = null;
  }

  async function entrar(): Promise<void> {
    if (entrando.value) return;

    entrando.value = true;
    erro.value = null;
    try {
      await entrarComGoogle();
    } catch (e) {
      erro.value = mensagemDeErro(e);
    } finally {
      entrando.value = false;
    }
  }

  /**
   * Sai sem apagar o IndexedDB. Limpar aqui descartaria o outbox pendente —
   * sair do app na academia, sem rede, perderia o treino que ainda não subiu.
   * A limpeza é ação explícita na tela de Ajustes.
   */
  async function encerrar(): Promise<void> {
    erro.value = null;
    try {
      await sair();
    } catch (e) {
      erro.value = mensagemDeErro(e);
    }
  }

  return {
    user,
    uid,
    uidConhecido,
    carregando,
    entrando,
    erro,
    autenticado,
    iniciar,
    parar,
    entrar,
    encerrar,
  };
});
