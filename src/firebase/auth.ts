/**
 * Autenticação com Google.
 *
 * DD-A12: `signInWithPopup`, não `signInWithRedirect`. O redirect depende de
 * cookies de terceiros e está quebrado no Safari e no Chrome com bloqueio
 * ativo. Como o `authDomain` é o próprio domínio do app, o popup é same-origin
 * e funciona.
 */

import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { obterAuth } from "./app.ts";

export type { User };

export interface Perfil {
  nome: string | null;
  email: string | null;
  foto: string | null;
}

export const perfilDe = (user: User): Perfil => ({
  nome: user.displayName,
  email: user.email,
  foto: user.photoURL,
});

export async function entrarComGoogle(): Promise<User> {
  const auth = obterAuth();

  // O Firebase Auth persiste em IndexedDB próprio: é isso que mantém a sessão
  // ao abrir o app offline.
  await setPersistence(auth, browserLocalPersistence);

  const provedor = new GoogleAuthProvider();
  provedor.setCustomParameters({ prompt: "select_account" });

  const { user } = await signInWithPopup(auth, provedor);
  return user;
}

export const sair = () => signOut(obterAuth());

/**
 * Observa a sessão. O primeiro disparo vem da persistência local, sem rede —
 * por isso o guard de rota deve esperar por ele em vez de decidir na hora, ou o
 * app pisca `/login` a cada abertura offline.
 */
export function observarAuth(aoMudar: (user: User | null) => void): () => void {
  return onAuthStateChanged(obterAuth(), aoMudar);
}

/** Mensagem legível para os erros de popup que o usuário realmente encontra. */
export function mensagemDeErro(erro: unknown): string {
  const codigo = (erro as { code?: string })?.code ?? "";

  const conhecidos: Record<string, string> = {
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/cancelled-popup-request": "Login cancelado.",
    "auth/popup-blocked": "O navegador bloqueou a janela de login. Libere o popup e tente de novo.",
    "auth/network-request-failed": "Sem conexão para entrar agora.",
    "auth/unauthorized-domain": "Domínio não autorizado no Firebase Authentication.",
    "auth/operation-not-allowed": "Login com Google não está habilitado no projeto.",
  };

  return conhecidos[codigo] ?? (erro instanceof Error ? erro.message : "Falha ao entrar.");
}
