using System;
using System.IO;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using MemoriaCalc.Revit.Core;

namespace MemoriaCalc.Revit;

internal static class SyncBridge
{
    public static UIControlledApplication? UiApp;
    public static ExternalEvent? Analizar;
    public static ExternalEvent? Sincronizar;
    public static ExternalEvent? Consultar;
    public static ConnectorPane? Pane;
    public static int Pendientes;
    public static DateTime? UltimoAnalisis;
    public static DateTime? UltimoSync;
    public static string UltimoMensaje = "Abra un RVT. Use Mostrar panel para conectar, analizar y sincronizar.";
    public static string ConsultaTexto = "";
    public static bool IncluirVinculos;
    public static RevitPaquete? UltimoPaquete;

    public static void Registrar(UIControlledApplication app)
    {
        UiApp = app;
        Analizar = ExternalEvent.Create(new AnalizarHandler());
        Sincronizar = ExternalEvent.Create(new SincronizarHandler());
        Consultar = ExternalEvent.Create(new ConsultarHandler());
    }
}

internal sealed class AnalizarHandler : IExternalEventHandler
{
    public void Execute(UIApplication app)
    {
        var doc = app.ActiveUIDocument?.Document;
        if (doc == null)
        {
            SyncBridge.UltimoMensaje = "Abra un proyecto de Revit.";
            SyncBridge.Pane?.Refrescar();
            return;
        }
        try
        {
            LocalCache.Log("analizar " + doc.Title);
            SyncBridge.UltimoPaquete = ModeloScanner.Escanear(doc, app.Application.VersionNumber, new ScanOptions { IncluirVinculos = SyncBridge.IncluirVinculos });
            SyncBridge.UltimoAnalisis = DateTime.Now;
            var c = SyncBridge.UltimoPaquete.Cambios;
            SyncBridge.Pendientes = c.Nuevos + c.Modificados + c.Eliminados;
            SyncBridge.UltimoMensaje =
                $"Análisis: {SyncBridge.UltimoPaquete.Elementos.Count} elementos · {SyncBridge.UltimoPaquete.Resumen.Count} categorías · " +
                $"nuevos {c.Nuevos} · modificados {c.Modificados} · eliminados {c.Eliminados}.";
        }
        catch (Exception ex)
        {
            LocalCache.Log("analizar error " + ex.Message);
            SyncBridge.UltimoMensaje = "No se pudo analizar: " + ex.Message;
        }
        SyncBridge.Pane?.Refrescar();
    }

    public string GetName() => "MemoriaCalc.Analizar";
}

internal sealed class SincronizarHandler : IExternalEventHandler
{
    public void Execute(UIApplication app)
    {
        var doc = app.ActiveUIDocument?.Document;
        if (doc == null)
        {
            SyncBridge.UltimoMensaje = "Abra un proyecto de Revit.";
            SyncBridge.Pane?.Refrescar();
            return;
        }
        try
        {
            var paquete = ModeloScanner.Escanear(doc, app.Application.VersionNumber, new ScanOptions { IncluirVinculos = SyncBridge.IncluirVinculos });
            SyncBridge.UltimoPaquete = paquete;
            var json = PaqueteBuilder.ToJson(paquete);
            File.WriteAllText(LocalCache.PendingPath(), json);
            LocalCache.Log("sync envío " + paquete.Elementos.Count + " elementos");
            var (ok, msg) = System.Threading.Tasks.Task.Run(() => ApiClient.Sincronizar(json)).GetAwaiter().GetResult();
            SyncBridge.UltimoMensaje = msg;
            if (ok)
            {
                SyncBridge.UltimoSync = DateTime.Now;
                SyncBridge.Pendientes = 0;
                LocalCache.Escribir(doc, paquete.Elementos.ToDictionary(e => e.UniqueId, e => e.Hash));
                try { File.Delete(LocalCache.PendingPath()); } catch { /* ya enviado */ }
                LocalCache.Log("sync ok");
            }
            else
            {
                LocalCache.Log("sync fail " + msg);
            }
        }
        catch (Exception ex)
        {
            LocalCache.Log("sync error " + ex.Message);
            SyncBridge.UltimoMensaje = "Sincronización fallida: " + ex.Message;
        }
        SyncBridge.Pane?.Refrescar();
    }

    public string GetName() => "MemoriaCalc.Sincronizar";
}

internal sealed class ConsultarHandler : IExternalEventHandler
{
    public void Execute(UIApplication app)
    {
        var uidoc = app.ActiveUIDocument;
        var doc = uidoc?.Document;
        if (uidoc == null || doc == null)
        {
            SyncBridge.ConsultaTexto = "Abra un proyecto y seleccione un elemento.";
            SyncBridge.Pane?.Refrescar();
            return;
        }
        var ids = uidoc.Selection.GetElementIds();
        if (ids == null || ids.Count == 0)
        {
            SyncBridge.ConsultaTexto = "Seleccione un elemento en el modelo y pulse Consultar selección.";
            SyncBridge.Pane?.Refrescar();
            return;
        }
        try
        {
            var el = doc.GetElement(ids.First());
            if (el == null)
            {
                SyncBridge.ConsultaTexto = "No se encontró el elemento seleccionado.";
                SyncBridge.Pane?.Refrescar();
                return;
            }
            var p = GenericExtractor.Extraer(doc, el, "host", "");
            var princ = p.Sync.Cantidades.FirstOrDefault(c => c.Principal) ?? p.Sync.Cantidades.FirstOrDefault();
            SyncBridge.ConsultaTexto =
                "ELEMENTO\n" +
                "Categoría: " + p.Sync.Categoria + "\n" +
                "Familia: " + p.Sync.Familia + "\n" +
                "Tipo: " + p.Sync.Tipo + "\n" +
                "Nivel: " + (string.IsNullOrWhiteSpace(p.Sync.Nivel) ? "—" : p.Sync.Nivel) + "\n" +
                "Material: " + (string.IsNullOrWhiteSpace(p.Sync.Material) ? "—" : p.Sync.Material) + "\n" +
                "UniqueId: " + p.Sync.UniqueId + "\n" +
                (princ == null ? "" : "Cantidad: " + princ.Valor.ToString("0.###") + " " + princ.Und + "\n") +
                "Estado: " + (ApiClient.Conectado ? "CONECTADO" : "SIN CONEXIÓN");
        }
        catch (Exception ex)
        {
            SyncBridge.ConsultaTexto = "No se pudo leer el elemento: " + ex.Message;
        }
        SyncBridge.Pane?.Refrescar();
    }

    public string GetName() => "MemoriaCalc.Consultar";
}

internal sealed class ModeloWatcher : IUpdater
{
    private readonly UpdaterId _id;
    public ModeloWatcher(AddInId addInId) => _id = new UpdaterId(addInId, new Guid("d4e8a1c2-91b0-4f33-9c77-2a6e0b18e4d1"));
    public void Execute(UpdaterData data) => SyncBridge.Pendientes++;
    public string GetAdditionalInformation() => "Marca cambios del modelo para MemoriaCalc.";
    public ChangePriority GetChangePriority() => ChangePriority.Annotations;
    public UpdaterId GetUpdaterId() => _id;
    public string GetUpdaterName() => "MemoriaCalc.ModeloWatcher";
}
