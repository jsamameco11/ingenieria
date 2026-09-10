/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
    readonly VITE_FOLIO_SUPABASE_URL?: string;
    readonly VITE_FOLIO_SUPABASE_ANON_KEY?: string;
    readonly VITE_GOOGLE_CLIENT_ID?: string;
    readonly VITE_GOOGLE_SESSION_URL?: string;
    readonly VITE_CULQI_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "pdfjs-dist/build/pdf.mjs";

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

interface Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}

declare module "*.json" {
  const value: unknown;
  export default value;
}

declare module "*?url" {
  const src: string;
  export default src;
}
