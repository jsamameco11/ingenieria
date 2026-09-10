import type { Insumo, RecursoKind } from "./types";

type Row = [string, RecursoKind, string, string, string, number, number, string];

function i(id: string, kind: RecursoKind, codigo: string, nombre: string, und: string, precio: number, iu: number, categoria: string): Insumo {
  return { id, kind, codigo, nombre, und, precio, iu, categoria };
}

const CAT = "Pisos y revestimientos";

/**
 * Complemento profesional de pisos: formatos de cerámico, mayólica y porcelanato
 * no cubiertos en el catálogo base, más insumos de apoyo (zócalos, fragua epóxica piso).
 * Precios de referencia S/ Lima; editables en obra.
 */
const RAW: Row[] = [
  // —— Cerámico piso (formatos adicionales) ——
  ["MAT-CER20", "mat", "MAT-950", "Cerámico piso 20×20 cm PEI III beige", "m²", 22, 24, CAT],
  ["MAT-CER20B", "mat", "MAT-951", "Cerámico piso 20×20 cm PEI III blanco", "m²", 22, 24, CAT],
  ["MAT-CER20G", "mat", "MAT-952", "Cerámico piso 20×20 cm PEI III gris", "m²", 23, 24, CAT],
  ["MAT-CER25", "mat", "MAT-953", "Cerámico piso 25×25 cm PEI III beige", "m²", 24, 24, CAT],
  ["MAT-CER25B", "mat", "MAT-954", "Cerámico piso 25×25 cm PEI III blanco", "m²", 24, 24, CAT],
  ["MAT-CER3045", "mat", "MAT-955", "Cerámico piso 30×45 cm PEI III beige", "m²", 30, 24, CAT],
  ["MAT-CER3045B", "mat", "MAT-956", "Cerámico piso 30×45 cm PEI III blanco", "m²", 30, 24, CAT],
  ["MAT-CER3045G", "mat", "MAT-957", "Cerámico piso 30×45 cm PEI III gris", "m²", 31, 24, CAT],
  ["MAT-CER3060", "mat", "MAT-958", "Cerámico piso 30×60 cm PEI IV beige", "m²", 34, 24, CAT],
  ["MAT-CER3060B", "mat", "MAT-959", "Cerámico piso 30×60 cm PEI IV blanco", "m²", 34, 24, CAT],
  ["MAT-CER3060G", "mat", "MAT-960", "Cerámico piso 30×60 cm PEI IV gris", "m²", 35, 24, CAT],
  ["MAT-CER3060M", "mat", "MAT-961", "Cerámico piso 30×60 cm PEI IV imitación madera", "m²", 38, 24, CAT],
  ["MAT-CER40", "mat", "MAT-962", "Cerámico piso 40×40 cm PEI IV beige", "m²", 33, 24, CAT],
  ["MAT-CER40B", "mat", "MAT-963", "Cerámico piso 40×40 cm PEI IV blanco", "m²", 33, 24, CAT],
  ["MAT-CER40G", "mat", "MAT-964", "Cerámico piso 40×40 cm PEI IV gris", "m²", 34, 24, CAT],
  ["MAT-CER50B", "mat", "MAT-965", "Cerámico piso 50×50 cm PEI IV blanco", "m²", 40, 24, CAT],
  ["MAT-CER50G", "mat", "MAT-966", "Cerámico piso 50×50 cm PEI IV gris", "m²", 41, 24, CAT],
  ["MAT-CER60B", "mat", "MAT-967", "Cerámico piso 60×60 cm PEI IV beige", "m²", 44, 24, CAT],
  ["MAT-CER60W", "mat", "MAT-968", "Cerámico piso 60×60 cm PEI IV blanco", "m²", 44, 24, CAT],
  ["MAT-CER60120", "mat", "MAT-969", "Cerámico piso 60×120 cm PEI IV mate cemento", "m²", 52, 24, CAT],
  ["MAT-CER60120M", "mat", "MAT-970", "Cerámico piso 60×120 cm PEI IV imitación madera", "m²", 55, 24, CAT],
  ["MAT-CER15", "mat", "MAT-971", "Cerámico piso 15×15 cm PEI III beige (baño / detalle)", "m²", 26, 24, CAT],
  ["MAT-CER3333", "mat", "MAT-972", "Cerámico piso 33×33 cm PEI III beige", "m²", 27, 24, CAT],
  ["MAT-CERR11", "mat", "MAT-973", "Cerámico piso 30×30 cm PEI IV antideslizante R11 (exterior)", "m²", 36, 24, CAT],
  ["MAT-CER3060R11", "mat", "MAT-974", "Cerámico piso 30×60 cm PEI IV antideslizante R11 (exterior)", "m²", 42, 24, CAT],
  ["MAT-ZOCC30", "mat", "MAT-975", "Zócalo cerámico 8×30 cm blanco", "m", 8.5, 24, CAT],
  ["MAT-ZOCC60", "mat", "MAT-976", "Zócalo cerámico 8×60 cm beige", "m", 11.5, 24, CAT],

  // —— Mayólica mural (formatos adicionales) ——
  ["MAT-MAY15", "mat", "MAT-977", "Mayólica mural 15×15 cm blanco brillante", "m²", 22, 24, CAT],
  ["MAT-MAY15B", "mat", "MAT-978", "Mayólica mural 15×15 cm beige", "m²", 22, 24, CAT],
  ["MAT-MAY25", "mat", "MAT-979", "Mayólica mural 25×25 cm blanco brillante", "m²", 25, 24, CAT],
  ["MAT-MAY25B", "mat", "MAT-980", "Mayólica mural 25×25 cm beige", "m²", 25, 24, CAT],
  ["MAT-MAY30", "mat", "MAT-981", "Mayólica mural 30×30 cm blanco brillante", "m²", 28, 24, CAT],
  ["MAT-MAY30B", "mat", "MAT-982", "Mayólica mural 30×30 cm beige", "m²", 28, 24, CAT],
  ["MAT-MAY30G", "mat", "MAT-983", "Mayólica mural 30×30 cm gris", "m²", 29, 24, CAT],
  ["MAT-MAY2025", "mat", "MAT-984", "Mayólica mural 20×25 cm blanco brillante", "m²", 25, 24, CAT],
  ["MAT-MAY40", "mat", "MAT-985", "Mayólica mural 40×40 cm blanco mate", "m²", 38, 24, CAT],
  ["MAT-MAY40B", "mat", "MAT-986", "Mayólica mural 40×40 cm beige", "m²", 38, 24, CAT],
  ["MAT-MAY45", "mat", "MAT-987", "Mayólica mural 45×45 cm blanco mate", "m²", 42, 24, CAT],
  ["MAT-MAY60", "mat", "MAT-988", "Mayólica mural 60×60 cm blanco mate", "m²", 48, 24, CAT],
  ["MAT-MAY3045B", "mat", "MAT-989", "Mayólica mural 30×45 cm beige", "m²", 36, 24, CAT],
  ["MAT-MAY3045G", "mat", "MAT-990", "Mayólica mural 30×45 cm gris", "m²", 37, 24, CAT],
  ["MAT-MAY3060B", "mat", "MAT-991", "Mayólica mural 30×60 cm beige", "m²", 42, 24, CAT],
  ["MAT-MAY3060G", "mat", "MAT-992", "Mayólica mural 30×60 cm gris", "m²", 43, 24, CAT],
  ["MAT-MAYSUB", "mat", "MAT-993", "Mayólica mural 20×20 cm subway / metro blanco", "m²", 32, 24, CAT],
  ["MAT-MAYMOS", "mat", "MAT-994", "Mosaico mayólica 2.5×2.5 cm sobre malla (baño)", "m²", 55, 24, CAT],
  ["MAT-ZOCMAY10", "mat", "MAT-995", "Zócalo de mayólica 10×20 cm blanco", "m", 7.5, 24, CAT],
  ["MAT-ZOCMAY30", "mat", "MAT-996", "Zócalo de mayólica 8×30 cm blanco", "m", 8.5, 24, CAT],

  // —— Porcelanato (formatos adicionales) ——
  ["MAT-POR30", "mat", "MAT-997", "Porcelanato 30×30 cm PEI IV mate beige", "m²", 48, 24, CAT],
  ["MAT-POR30B", "mat", "MAT-998", "Porcelanato 30×30 cm PEI IV mate blanco", "m²", 48, 24, CAT],
  ["MAT-POR30G", "mat", "MAT-999", "Porcelanato 30×30 cm PEI IV mate gris", "m²", 49, 24, CAT],
  ["MAT-POR45", "mat", "MAT-1000", "Porcelanato 45×45 cm PEI IV mate beige", "m²", 52, 24, CAT],
  ["MAT-POR45B", "mat", "MAT-1001", "Porcelanato 45×45 cm PEI IV mate blanco", "m²", 52, 24, CAT],
  ["MAT-POR45G", "mat", "MAT-1002", "Porcelanato 45×45 cm PEI IV mate gris", "m²", 53, 24, CAT],
  ["MAT-POR3060B", "mat", "MAT-1003", "Porcelanato 30×60 cm PEI IV mate blanco", "m²", 52, 24, CAT],
  ["MAT-POR3060G", "mat", "MAT-1004", "Porcelanato 30×60 cm PEI IV mate gris", "m²", 53, 24, CAT],
  ["MAT-POR3060M", "mat", "MAT-1005", "Porcelanato 30×60 cm PEI IV imitación madera", "m²", 58, 24, CAT],
  ["MAT-POR50", "mat", "MAT-1006", "Porcelanato 50×50 cm PEI IV mate beige", "m²", 54, 24, CAT],
  ["MAT-POR100", "mat", "MAT-1007", "Porcelanato 100×100 cm PEI IV pulido beige rectificado", "m²", 125, 24, CAT],
  ["MAT-POR100CAL", "mat", "MAT-1008", "Porcelanato 100×100 cm PEI IV pulido mármol calacatta", "m²", 145, 24, CAT],
  ["MAT-POR1590", "mat", "MAT-1009", "Porcelanato listón 15×90 cm PEI IV imitación madera", "m²", 78, 24, CAT],
  ["MAT-POR2090", "mat", "MAT-1010", "Porcelanato listón 20×90 cm PEI IV imitación madera", "m²", 80, 24, CAT],
  ["MAT-POR30120", "mat", "MAT-1011", "Porcelanato listón 30×120 cm PEI IV imitación madera", "m²", 92, 24, CAT],
  ["MAT-POR120120", "mat", "MAT-1012", "Porcelanato 120×120 cm PEI IV pulido beige rectificado", "m²", 155, 24, CAT],
  ["MAT-POR80M", "mat", "MAT-1013", "Porcelanato 80×80 cm PEI IV mate imitación madera", "m²", 88, 24, CAT],
  ["MAT-POR90G", "mat", "MAT-1014", "Porcelanato 90×90 cm PEI IV mate gris rectificado", "m²", 102, 24, CAT],
  ["MAT-POR90B", "mat", "MAT-1015", "Porcelanato 90×90 cm PEI IV pulido blanco rectificado", "m²", 105, 24, CAT],
  ["MAT-PORR11", "mat", "MAT-1016", "Porcelanato 60×60 cm PEI V antideslizante R11 (exterior)", "m²", 78, 24, CAT],
  ["MAT-POR3060R11", "mat", "MAT-1017", "Porcelanato 30×60 cm PEI IV antideslizante R11 (exterior)", "m²", 62, 24, CAT],
  ["MAT-ZOCPOR45", "mat", "MAT-1018", "Zócalo de porcelanato 8×45 cm beige", "m", 11.5, 24, CAT],
  ["MAT-ZOCPOR80", "mat", "MAT-1019", "Zócalo de porcelanato 8×80 cm beige", "m", 14.5, 24, CAT],
  ["MAT-ZOCPOR120", "mat", "MAT-1020", "Zócalo de porcelanato 8×120 cm beige", "m", 16.5, 24, CAT],

  // —— Apoyo contrapiso / colocación ——
  ["MAT-MALLPISO", "mat", "MAT-1021", "Malla electrosoldada Q-106 para contrapiso / falso piso", "m²", 8.5, 3, CAT],
  ["MAT-POLIET", "mat", "MAT-1022", "Polietileno 0.10 mm (barrera vapor bajo falso piso)", "m²", 1.8, 39, CAT],
  ["MAT-FRABLAN", "mat", "MAT-1023", "Fragua blanca para mayólica / cerámico", "kg", 2.8, 39, CAT],
  ["MAT-FRAGRIS", "mat", "MAT-1024", "Fragua gris para cerámico / porcelanato", "kg", 2.4, 39, CAT],
  ["MAT-CRUZ3", "mat", "MAT-1025", "Crucetas niveladoras 3 mm (bolsa)", "bls", 12, 39, CAT],
  ["MAT-CRUZ2", "mat", "MAT-1026", "Crucetas niveladoras 2 mm (bolsa)", "bls", 12, 39, CAT],
  ["MAT-NIVCLIC", "mat", "MAT-1027", "Sistema nivelador clip + cuña (bolsa 100 und)", "bls", 28, 39, CAT],
];

export const INSUMOS_PISOS: Insumo[] = RAW.map((row) => i(...row));
