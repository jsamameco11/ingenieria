using Autodesk.Revit.DB;
using MemoriaCalc.Revit.Core;

namespace MemoriaCalc.Revit;

internal static class ModeloLector
{
    public static RevitPaquete Leer(Document doc, System.Collections.Generic.ICollection<ElementId>? soloIds, string versionRevit) =>
        ModeloScanner.Escanear(doc, versionRevit, new ScanOptions { SoloIds = soloIds, IncluirVinculos = soloIds == null || soloIds.Count == 0 });
}
