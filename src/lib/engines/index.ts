import { estructuras } from "./estructuras";
import { puentes } from "./puentes";
import { geotecnia } from "./geotecnia";
import { otros } from "./otros";
import { pavimentosAashto } from "./pavimentos";
import { murosTierraEngines } from "./murosTierra";
import { tanquesEngines } from "./tanques";
import { mezclas } from "./mezclas";
import { dotacionComercial, dotacionEducacion, dotacionEspectaculo, dotacionHotel, dotacionHospital, dotacionMultifamiliar, dotacionOficinas, dotacionRestaurante, dotacionUnifamiliar } from "./dotacion";
import type { Engine } from "../types";

export const ENGINES: Record<string, Engine> = {
  ...estructuras,
  ...puentes,
  ...geotecnia,
  ...otros,
  ...pavimentosAashto,
  ...murosTierraEngines,
  ...tanquesEngines,
  ...mezclas,
  dotacionUnifamiliar,
  dotacionMultifamiliar,
  dotacionHotel,
  dotacionRestaurante,
  dotacionHospital,
  dotacionOficinas,
  dotacionComercial,
  dotacionEducacion,
  dotacionEspectaculo,
};

export function runEngine(name: string, raw: Record<string, string>) {
  const fn = ENGINES[name];
  if (!fn) {
    return {
      headline: "Motor no encontrado",
      adoption: name,
      steps: [],
      checks: [],
    };
  }
  return fn(raw);
}
