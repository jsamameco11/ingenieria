export function extractionDebugEnabled(): boolean {
  try {
    if (localStorage.getItem("EXTRACTION_DEBUG") === "true") return true;
    return new URLSearchParams(window.location.search).get("extraction_debug") === "1";
  } catch {
    return false;
  }
}

export type DebugFrame = {
  at: string;
  input: string;
  normalized: unknown;
  extracted: unknown;
  matched: string[];
  confidence: number[];
  evidence: unknown;
  signals: string[];
  result?: unknown;
};

const frames: DebugFrame[] = [];

export function pushDebugFrame(frame: DebugFrame) {
  frames.unshift(frame);
  if (frames.length > 12) frames.pop();
  try {
    (window as unknown as { __PERFIL_DEBUG__?: DebugFrame[] }).__PERFIL_DEBUG__ = frames;
  } catch {
    /* */
  }
}

export function readDebugFrames(): DebugFrame[] {
  return frames.slice();
}
