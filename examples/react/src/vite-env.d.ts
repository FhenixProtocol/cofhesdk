/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCALCOFHE_RPC_URL?: string;
  readonly VITE_LOCALCOFHE_TN_URL?: string;
  readonly VITE_LOCALCOFHE_VERIFIER_URL?: string;
  readonly VITE_LOCALCOFHE_COFHE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
