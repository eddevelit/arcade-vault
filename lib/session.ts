import { useSyncExternalStore } from "react";

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export interface StoredUser {
  name: string;
}

export interface StoredScoreEntry {
  game: string;
  score: number;
  name: string;
  at: number;
}

export function getUser(): StoredUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
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

export function getScores(): StoredScoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveScore(entry: Omit<StoredScoreEntry, "at">): void {
  try {
    const all = getScores();
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    // localStorage puede fallar en modo privado o con cuota excedida; se ignora, igual que en app.jsx
  }
}
