import { type Engine } from "../types";
import { estriboPantalla } from "./estriboPantalla";
import { estriboGravedad } from "./estriboGravedad";
import {
  apoyoElast,
  cargasAashto,
  lineaInfluencia,
  pasarelaColgante,
  placaApoyo,
  puenteCajon,
  puenteVehicular,
  travesano,
  vigaDiafragma,
  vigaPresforzada,
} from "./puentesSuper";
import { losaPuente, puenteLosa } from "./losaTablero";

export { estriboPantalla as estriboVoladizo };
export { estriboGravedad };
export {
  apoyoElast,
  cargasAashto,
  lineaInfluencia,
  losaPuente,
  pasarelaColgante,
  placaApoyo,
  puenteCajon,
  puenteLosa,
  puenteVehicular,
  travesano,
  vigaDiafragma,
  vigaPresforzada,
};

export const puentes: Record<string, Engine> = {
  estriboVoladizo: estriboPantalla,
  estriboGravedad,
  losaPuente,
  apoyoElast,
  placaApoyo,
  puenteVehicular,
  vigaPresforzada,
  cargasAashto,
  puenteLosa,
  vigaDiafragma,
  travesano,
  puenteCajon,
  pasarelaColgante,
  lineaInfluencia,
};
