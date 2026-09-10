using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using MemoriaCalc.Revit.Core;

namespace MemoriaCalc.Revit;

[Transaction(TransactionMode.Manual)]
[Regeneration(RegenerationOption.Manual)]
public sealed class UpdateCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        try
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            var rel = Task.Run(LeerRelease).GetAwaiter().GetResult();
            if (rel == null || string.IsNullOrWhiteSpace(rel.Version))
            {
                TaskDialog.Show(
                    "MemoriaCalc",
                    "No se pudo consultar la versión publicada.\nRevise la conexión e inténtelo de nuevo.\n\nVersión instalada: " + AddinInfo.Version);
                return Result.Succeeded;
            }

            if (Compare(rel.Version, AddinInfo.Version) <= 0)
            {
                TaskDialog.Show(
                    "MemoriaCalc",
                    "El plugin está al día.\n\nInstalada: " + AddinInfo.Version + "\nPublicada: " + rel.Version +
                    (string.IsNullOrWhiteSpace(rel.Notes) ? "" : "\n\n" + rel.Notes));
                return Result.Succeeded;
            }

            var ask = new TaskDialog("MemoriaCalc")
            {
                MainInstruction = "Hay una versión nueva",
                MainContent = "Instalada: " + AddinInfo.Version + "\nPublicada: " + rel.Version +
                    (string.IsNullOrWhiteSpace(rel.Notes) ? "" : "\n\n" + rel.Notes) +
                    "\n\nSe abrirá el instalador de Windows. Cierre Revit cuando se lo pida y vuelva a abrir el RVT.",
                CommonButtons = TaskDialogCommonButtons.Cancel,
            };
            ask.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Descargar e instalar " + rel.Version);
            if (ask.Show() != TaskDialogResult.CommandLink1) return Result.Cancelled;

            var url = string.IsNullOrWhiteSpace(rel.SetupUrl) ? AddinInfo.ProductUrl + "/addin/MemoriaCalc.Revit.Setup.exe" : rel.SetupUrl;
            var dest = Path.Combine(Path.GetTempPath(), "MemoriaCalc.Revit.Setup.exe");
            Task.Run(() => Descargar(url, dest)).GetAwaiter().GetResult();
            Process.Start(new ProcessStartInfo
            {
                FileName = dest,
                UseShellExecute = true,
            });
            TaskDialog.Show("MemoriaCalc", "Instalador abierto. Cierre Revit para completar la actualización y ábralo de nuevo.");
            return Result.Succeeded;
        }
        catch (Exception ex)
        {
            message = ex.Message;
            TaskDialog.Show("MemoriaCalc", "No se pudo actualizar.\n\n" + ex.Message);
            return Result.Failed;
        }
    }

    private static async Task<Release?> LeerRelease()
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("MemoriaCalc-Revit/" + AddinInfo.Version);
        var raw = await http.GetStringAsync(AddinInfo.UpdateManifest).ConfigureAwait(false);
        if (raw.IndexOf("<html", StringComparison.OrdinalIgnoreCase) >= 0) return null;
        return JsonSerializer.Deserialize<Release>(raw);
    }

    private static async Task Descargar(string url, string dest)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(3) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("MemoriaCalc-Revit/" + AddinInfo.Version);
        var bytes = await http.GetByteArrayAsync(url).ConfigureAwait(false);
        File.WriteAllBytes(dest, bytes);
    }

    private static int Compare(string a, string b)
    {
        var pa = Parse(a);
        var pb = Parse(b);
        for (var i = 0; i < 3; i++)
        {
            if (pa[i] != pb[i]) return pa[i].CompareTo(pb[i]);
        }
        return 0;
    }

    private static int[] Parse(string v)
    {
        var n = new[] { 0, 0, 0 };
        var parts = (v ?? "").Split('.');
        for (var i = 0; i < Math.Min(3, parts.Length); i++)
            int.TryParse(parts[i], out n[i]);
        return n;
    }

    private sealed class Release
    {
        [System.Text.Json.Serialization.JsonPropertyName("version")]
        public string Version { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("notes")]
        public string Notes { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("setupUrl")]
        public string SetupUrl { get; set; } = "";
    }
}
