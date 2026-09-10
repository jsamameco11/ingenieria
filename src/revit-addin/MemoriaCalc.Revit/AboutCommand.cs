using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using MemoriaCalc.Revit.Core;

namespace MemoriaCalc.Revit;

[Transaction(TransactionMode.Manual)]
[Regeneration(RegenerationOption.Manual)]
public sealed class AboutCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        TaskDialog.Show(
            "MemoriaCalc",
            "Conector BIM · " + AddinInfo.Version + "\n" +
            "API /api/" + AddinInfo.ApiVersion + "/revit\n\n" +
            "Cinta MemoriaCalc → Mostrar panel.\n" +
            "1. En la web (Plan Pro) genere el código.\n" +
            "2. Conectar en el panel.\n" +
            "3. Analizar modelo y Sincronizar.\n" +
            "Los metrados llegan a Vincular con Revit.\n\n" +
            AddinInfo.ProductUrl);
        return Result.Succeeded;
    }
}
