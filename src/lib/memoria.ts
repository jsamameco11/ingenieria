export type Kv = { k: string; v: string; u?: string; hint?: string };

export type Block =
  | { type: "cover"; titulo: string; subtitulo: string; meta: Kv[]; kicker?: string }
  | { type: "photo"; src: string; caption: string; placeholder?: string }
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "note"; text: string }
  | { type: "eq"; text: string; num?: string }
  | { type: "kv"; rows: Kv[] }
  | { type: "table"; caption?: string; headers: string[]; rows: string[][]; variant?: "valores" | "wide" | "text" }
  | { type: "kpis"; items: { label: string; value: string; hint?: string }[] }
  | { type: "firma"; perito: string; fecha: string; lugar: string }
  | { type: "gallery"; items: { src: string; caption: string; placeholder?: string }[] }
  | { type: "check"; ok: boolean; text: string }
  | { type: "list"; items: string[] }
  | {
      type: "paso";
      n: string;
      titulo: string;
      formula: string;
      sustituye: string;
      resultado: string;
      interpreta?: string;
      desarrollo?: string[];
    }
  | { type: "figure"; part: string };

export interface MemoriaDoc {
  codigo: string;
  titulo: string;
  norma: string;
  blocks: Block[];
}

export function paso(
  n: string,
  titulo: string,
  formula: string,
  sustituye: string,
  resultado: string,
  interpreta?: string,
  desarrollo?: string[]
): Block {
  return { type: "paso", n, titulo, formula, sustituye, resultado, interpreta, desarrollo };
}
