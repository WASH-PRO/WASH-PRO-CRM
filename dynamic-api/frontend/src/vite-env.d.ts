/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WASH_EMBEDDED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
