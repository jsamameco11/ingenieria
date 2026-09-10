import { analizar } from "./analyze";
import type { BuildingProject } from "./types";

self.onmessage = (ev: MessageEvent<BuildingProject>) => {
  try {
    self.postMessage(analizar(ev.data));
  } catch (err) {
    self.postMessage({
      ok: false,
      message: err instanceof Error ? err.message : "Error en el solver local.",
      combos: [],
    });
  }
};
