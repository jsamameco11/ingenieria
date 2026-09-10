using System;
using System.IO;
using System.Linq;
using System.Text;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using MemoriaCalc.Revit.Core;
using WinForms = System.Windows.Forms;

namespace MemoriaCalc.Revit;

[Transaction(TransactionMode.Manual)]
[Regeneration(RegenerationOption.Manual)]
public sealed class ExportCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        var uidoc = commandData.Application.ActiveUIDocument;
        if (uidoc?.Document == null)
        {
            TaskDialog.Show("MemoriaCalc", "Abra un proyecto de Revit (.rvt) antes de exportar.");
            return Result.Cancelled;
        }

        var doc = uidoc.Document;
        var ids = uidoc.Selection.GetElementIds();
        var soloSeleccion = false;
        if (ids != null && ids.Count > 0)
        {
            var ask = new TaskDialog("MemoriaCalc")
            {
                MainInstruction = "Hay elementos seleccionados",
                MainContent = "El plugin puede medir solo esa selección o todo el modelo, incluidos vínculos cargados.",
                CommonButtons = TaskDialogCommonButtons.Cancel,
            };
            ask.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Exportar solo la selección");
            ask.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Exportar todo el modelo");
            var choice = ask.Show();
            if (choice == TaskDialogResult.Cancel) return Result.Cancelled;
            soloSeleccion = choice == TaskDialogResult.CommandLink1;
        }

        RevitPaquete paquete;
        try
        {
            paquete = ModeloLector.Leer(
                doc,
                soloSeleccion ? ids : null,
                commandData.Application.Application.VersionNumber);
        }
        catch (Exception ex)
        {
            message = ex.Message;
            TaskDialog.Show("MemoriaCalc", "No se pudo leer el modelo.\n\n" + ex.Message);
            return Result.Failed;
        }

        var n = paquete.Grupos.Sum(g => g.NElementos);
        if (n == 0)
        {
            TaskDialog.Show(
                "MemoriaCalc",
                "No se encontraron elementos de modelo medibles en este documento.");
            return Result.Cancelled;
        }

        var nombre = SafeName(paquete.Obra.Nombre);
        if (string.IsNullOrWhiteSpace(nombre)) nombre = "modelo";
        string path;
        using (var dlg = new WinForms.SaveFileDialog())
        {
            dlg.Title = "Guardar paquete MemoriaCalc";
            dlg.Filter = "Paquete MemoriaCalc (*.mcrevit.json)|*.mcrevit.json|JSON (*.json)|*.json";
            dlg.FileName = nombre + ".mcrevit.json";
            dlg.AddExtension = true;
            dlg.OverwritePrompt = true;
            if (dlg.ShowDialog() != WinForms.DialogResult.OK) return Result.Cancelled;
            path = dlg.FileName;
        }

        try
        {
            File.WriteAllText(path, PaqueteBuilder.ToJson(paquete), new UTF8Encoding(false));
        }
        catch (Exception ex)
        {
            message = ex.Message;
            TaskDialog.Show("MemoriaCalc", "No se pudo escribir el archivo.\n\n" + ex.Message);
            return Result.Failed;
        }

        var done = new TaskDialog("MemoriaCalc")
        {
            MainInstruction = "Paquete exportado",
            MainContent =
                $"{n} elemento{(n == 1 ? "" : "s")} en {paquete.Grupos.Count} grupo{(paquete.Grupos.Count == 1 ? "" : "s")}.\n" +
                $"Archivo:\n{path}\n\n" +
                "En MemoriaCalc → Presupuestos → Vincular con Revit, cargue este archivo, una las partidas y genere el cronograma.",
            CommonButtons = TaskDialogCommonButtons.Ok,
        };
        done.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Abrir la carpeta del archivo");
        if (done.Show() == TaskDialogResult.CommandLink1)
        {
            try
            {
                System.Diagnostics.Process.Start("explorer.exe", "/select,\"" + path + "\"");
            }
            catch
            {
                /* el usuario puede abrir la carpeta a mano */
            }
        }

        return Result.Succeeded;
    }

    private static string SafeName(string raw)
    {
        var t = (raw ?? "").Trim();
        foreach (var c in Path.GetInvalidFileNameChars()) t = t.Replace(c, '-');
        return t;
    }
}
