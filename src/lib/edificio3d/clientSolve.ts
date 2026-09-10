import { analizar } from "./analyze";
import type { AnalysisResult, BuildingProject } from "./types";

/** Resuelve 100 % en el PC del usuario (Web Worker). El VPS no calcula. */
export function analizarEnCliente(project: BuildingProject): Promise<AnalysisResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(analizar(project));
  }
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./analyze.worker.ts", import.meta.url), { type: "module" });
    const done = (r: AnalysisResult) => {
      worker.terminate();
      resolve(r);
    };
    worker.onmessage = (ev: MessageEvent<AnalysisResult>) => done(ev.data);
    worker.onerror = () => done(analizar(project));
    worker.postMessage(project);
  });
}
