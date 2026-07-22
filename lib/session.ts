import { useSyncExternalStore } from "react";

const USER_KEY = "av_user";

export interface StoredUser {
  name: string;
}

let cachedUserRaw: string | null | undefined;
let cachedUser: StoredUser | null = null;

// useSyncExternalStore requiere que getSnapshot devuelva la misma referencia
// si el valor subyacente no cambió; JSON.parse siempre crea un objeto nuevo,
// lo que causaba un loop infinito de renders al iniciar sesión.
export function getUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (raw === cachedUserRaw) return cachedUser;
  cachedUserRaw = raw;
  try {
    cachedUser = raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}

const userListeners = new Set<() => void>();

function subscribeUser(callback: () => void): () => void {
  userListeners.add(callback);
  return () => userListeners.delete(callback);
}

function getServerUser(): StoredUser | null {
  return null;
}

// Sincroniza componentes con av_user sin setState-en-effect, evitando el
// desajuste de hidratación SSR/CSR: el snapshot de servidor es siempre null.
export function useStoredUser(): StoredUser | null {
  return useSyncExternalStore(subscribeUser, getUser, getServerUser);
}

export function saveUser(user: StoredUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  userListeners.forEach((listener) => listener());
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
  userListeners.forEach((listener) => listener());
}
