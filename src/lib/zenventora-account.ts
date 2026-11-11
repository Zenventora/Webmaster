export type ZenVentoraSession = {
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  accessToken?: string | null;
  refreshToken?: string | null;
} | null;

export type ZenVentoraAccountClient = {
  getSession(): Promise<ZenVentoraSession>;
  onSessionChange(callback: (session: ZenVentoraSession) => void): () => void;
  signIn(product?: string, returnTo?: string): void;
  signUp(product?: string, returnTo?: string): void;
  openAccount(): void;
  signOut(): void;
  getAccessToken(): string | null;
};

declare global {
  interface Window {
    ZenVentoraAccount?: ZenVentoraAccountClient;
  }
}

const SCRIPT_URL = "https://zenventora.in/zenventora-account-client.js";
let loadPromise: Promise<ZenVentoraAccountClient> | null = null;

function loadClient(): Promise<ZenVentoraAccountClient> {
  if (window.ZenVentoraAccount) return Promise.resolve(window.ZenVentoraAccount);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.dataset.zenventoraAccountClient = "1";
    script.defer = true;
    script.onload = () => window.ZenVentoraAccount ? resolve(window.ZenVentoraAccount) : reject(new Error("ZenVentora account client loaded without its API."));
    script.onerror = () => reject(new Error("Could not load the ZenVentora account client."));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export async function getZenVentoraAccount() {
  return loadClient();
}
