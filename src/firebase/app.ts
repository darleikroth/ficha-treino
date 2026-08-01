/**
 * Inicialização do Firebase.
 *
 * Único ponto do app que chama `initializeApp`. Nada aqui faz I/O de rede na
 * carga: `getAuth` e `getDatabase` só criam handles. O boot não pode bloquear em
 * chamada de auth (DD-A12) — quem resolve a sessão é `onAuthStateChanged`, a
 * partir da persistência local.
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase, type Database } from "firebase/database";

const OBRIGATORIAS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_DATABASE_URL",
] as const;

export const usandoEmulador = import.meta.env.VITE_FIREBASE_EMULADOR === "true";

function exigirVariaveis(): void {
  const faltando = OBRIGATORIAS.filter((chave) => !import.meta.env[chave]);
  if (faltando.length === 0) return;

  // Falhar alto e cedo. Sem isso o app sobe, o login parece funcionar e a
  // primeira escrita morre em silêncio com o dado já no outbox.
  throw new Error(
    `Config do Firebase incompleta em .env.local: ${faltando.join(", ")}. ` +
      `Veja .env.example.`,
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let bd: Database | null = null;

export function obterApp(): FirebaseApp {
  if (app) return app;
  exigirVariaveis();

  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });

  return app;
}

export function obterAuth(): Auth {
  if (auth) return auth;

  auth = getAuth(obterApp());
  if (usandoEmulador) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

export function obterBd(): Database {
  if (bd) return bd;

  bd = getDatabase(obterApp());
  if (usandoEmulador) connectDatabaseEmulator(bd, "127.0.0.1", 9000);
  return bd;
}

/**
 * Não existe persistência em disco para configurar aqui.
 * `setPersistenceEnabled` só existe nos SDKs Android e iOS; no browser o cache
 * do RTDB é em memória e morre no reload. É por isso que existe `db/` (DD-A02).
 */
