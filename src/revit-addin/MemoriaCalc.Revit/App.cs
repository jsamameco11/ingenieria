using System;
using System.IO;
using System.Reflection;
using System.Windows.Media.Imaging;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace MemoriaCalc.Revit;

public sealed class App : IExternalApplication
{
    public const string TabName = "MemoriaCalc";
    public static readonly DockablePaneId PaneId = new(new Guid("e7b41c90-2d6a-4f18-9a55-0c8e4d77b201"));
    private ModeloWatcher? _watcher;

    public Result OnStartup(UIControlledApplication application)
    {
        SyncBridge.Pane = new ConnectorPane();
        application.RegisterDockablePane(PaneId, "MemoriaCalc", SyncBridge.Pane);
        SyncBridge.Registrar(application);

        try
        {
            _watcher = new ModeloWatcher(application.ActiveAddInId);
            UpdaterRegistry.RegisterUpdater(_watcher);
            UpdaterRegistry.AddTrigger(_watcher.GetUpdaterId(), new ElementIsElementTypeFilter(true), Element.GetChangeTypeAny());
        }
        catch
        {
            /* el panel funciona aunque el watcher no se registre */
        }

        try { application.CreateRibbonTab(TabName); }
        catch (Autodesk.Revit.Exceptions.ArgumentException) { }

        var panel = application.CreateRibbonPanel(TabName, "Conector BIM");
        var dll = Assembly.GetExecutingAssembly().Location;

        var paneBtn = new PushButtonData("MC_Panel", "Mostrar\npanel", dll, "MemoriaCalc.Revit.TogglePaneCommand");
        paneBtn.ToolTip = "Muestra u oculta el panel de conexión, análisis y sincronización.";
        AsignarIcono(paneBtn, "export");

        var analizar = new PushButtonData("MC_Analizar", "Analizar\nmodelo", dll, "MemoriaCalc.Revit.AnalyzeCommand");
        analizar.ToolTip = "Descubre categorías y elementos del RVT (UniqueId, geometría y cantidades).";
        AsignarIcono(analizar, "export");

        var sync = new PushButtonData("MC_Sync", "Sincronizar", dll, "MemoriaCalc.Revit.SyncCommand");
        sync.ToolTip = "Envía UniqueId, cantidades y metadatos a Vincular con Revit.";
        AsignarIcono(sync, "update");

        var consultar = new PushButtonData("MC_Consultar", "Consultar\nselección", dll, "MemoriaCalc.Revit.InspectCommand");
        consultar.ToolTip = "Muestra categoría, familia, UniqueId y metrado del elemento seleccionado.";
        AsignarIcono(consultar, "about");

        var exportar = new PushButtonData("MC_Exportar", "Exportar\narchivo", dll, "MemoriaCalc.Revit.ExportCommand");
        exportar.ToolTip = "Copia de respaldo: guarda un .mcrevit.json sin pasar por la API.";
        AsignarIcono(exportar, "export");

        var actualizar = new PushButtonData("MC_Actualizar", "Actualizar\nplugin", dll, "MemoriaCalc.Revit.UpdateCommand");
        actualizar.ToolTip = "Consulta la versión publicada e instala la actualización.";
        AsignarIcono(actualizar, "update");

        var acerca = new PushButtonData("MC_Acerca", "Acerca de", dll, "MemoriaCalc.Revit.AboutCommand");
        AsignarIcono(acerca, "about");

        panel.AddItem(paneBtn);
        panel.AddItem(analizar);
        panel.AddItem(sync);
        panel.AddItem(consultar);
        panel.AddSeparator();
        panel.AddItem(exportar);
        panel.AddItem(actualizar);
        panel.AddItem(acerca);
        return Result.Succeeded;
    }

    public Result OnShutdown(UIControlledApplication application)
    {
        try
        {
            if (_watcher != null) UpdaterRegistry.UnregisterUpdater(_watcher.GetUpdaterId());
        }
        catch { /* cierre */ }
        return Result.Succeeded;
    }

    private static void AsignarIcono(PushButtonData data, string name)
    {
        try
        {
            var dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            if (dir == null) return;
            var large = Path.Combine(dir, $"mc_{name}_32.png");
            var small = Path.Combine(dir, $"mc_{name}_16.png");
            if (File.Exists(large)) data.LargeImage = LoadPng(large);
            if (File.Exists(small)) data.Image = LoadPng(small);
        }
        catch { /* sin icono */ }
    }

    private static BitmapImage LoadPng(string path)
    {
        var img = new BitmapImage();
        img.BeginInit();
        img.UriSource = new Uri(path, UriKind.Absolute);
        img.CacheOption = BitmapCacheOption.OnLoad;
        img.EndInit();
        img.Freeze();
        return img;
    }
}
