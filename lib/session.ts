/**
 * Sessione effimera: vive solo nel browser e muore all'alba.
 * Il token è il segreto per scrivere; il sessionId serve solo
 * a riconoscere i propri messaggi.
 */
export interface BarSession {
  token: string;
  sessionId: string;
  pseudonym: string;
  /** ISO: l'alba locale, quando tutto brucia. */
  expiresAt: string;
  offsetMin: number;
}

const KEY = "bdn.session";

export function getStoredSession(): BarSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as BarSession;
    if (!s.token || !s.pseudonym || !s.expiresAt) return null;
    if (new Date(s.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function storeSession(s: BarSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
