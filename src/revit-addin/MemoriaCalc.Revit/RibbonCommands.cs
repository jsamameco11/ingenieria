using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace MemoriaCalc.Revit;

[Transaction(TransactionMode.Manual)]
public sealed class AnalyzeCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        SyncBridge.Analizar?.Raise();
        return Result.Succeeded;
    }
}

[Transaction(TransactionMode.Manual)]
public sealed class SyncCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        SyncBridge.Sincronizar?.Raise();
        return Result.Succeeded;
    }
}

[Transaction(TransactionMode.Manual)]
public sealed class InspectCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        try
        {
            var pane = commandData.Application.GetDockablePane(App.PaneId);
            if (!pane.IsShown()) pane.Show();
        }
        catch { /* el ExternalEvent igual consulta */ }
        SyncBridge.Consultar?.Raise();
        return Result.Succeeded;
    }
}
