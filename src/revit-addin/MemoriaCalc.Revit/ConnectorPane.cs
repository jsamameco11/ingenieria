using System;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Autodesk.Revit.UI;
using MemoriaCalc.Revit.Core;

namespace MemoriaCalc.Revit;

public sealed class ConnectorPane : Page, IDockablePaneProvider
{
    private readonly TextBlock _estado;
    private readonly TextBlock _detalle;
    private readonly System.Windows.Controls.TextBox _preview;
    private readonly System.Windows.Controls.TextBox _api;
    private readonly System.Windows.Controls.TextBox _codigo;
    private readonly CheckBox _vinculos;

    public ConnectorPane()
    {
        Background = new SolidColorBrush(Color.FromRgb(18, 38, 58));
        var gold = new SolidColorBrush(Color.FromRgb(196, 160, 86));
        var cream = new SolidColorBrush(Color.FromRgb(232, 224, 210));
        var stack = new StackPanel { Margin = new Thickness(14) };

        stack.Children.Add(new TextBlock { Text = "MEMORIACALC", Foreground = gold, FontSize = 11, FontWeight = FontWeights.Bold });
        stack.Children.Add(new TextBlock
        {
            Text = "Conector BIM",
            Foreground = new SolidColorBrush(Colors.White),
            FontSize = 20,
            FontFamily = new FontFamily("Georgia"),
            Margin = new Thickness(0, 2, 0, 10),
        });

        _estado = new TextBlock { Foreground = gold, FontSize = 13, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 8) };
        _detalle = new TextBlock { Foreground = cream, FontSize = 12, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 12) };
        stack.Children.Add(_estado);
        stack.Children.Add(_detalle);

        stack.Children.Add(Label("API de la plataforma", gold));
        _api = new System.Windows.Controls.TextBox { Text = ApiClient.State.ApiBase, Margin = new Thickness(0, 0, 0, 8), Padding = new Thickness(6) };
        stack.Children.Add(_api);

        stack.Children.Add(Label("Código de Vincular con Revit", gold));
        _codigo = new System.Windows.Controls.TextBox { Margin = new Thickness(0, 0, 0, 8), Padding = new Thickness(6) };
        stack.Children.Add(_codigo);
        stack.Children.Add(Boton("Conectar", gold, Conectar));

        _vinculos = new CheckBox { Content = "Incluir modelos vinculados", Foreground = cream, Margin = new Thickness(0, 12, 0, 8) };
        _vinculos.Checked += (_, __) => SyncBridge.IncluirVinculos = true;
        _vinculos.Unchecked += (_, __) => SyncBridge.IncluirVinculos = false;
        stack.Children.Add(_vinculos);

        stack.Children.Add(Boton("Analizar modelo", cream, () => SyncBridge.Analizar?.Raise()));
        stack.Children.Add(Boton("Sincronizar con la web", gold, () => SyncBridge.Sincronizar?.Raise()));
        stack.Children.Add(Boton("Consultar selección", cream, () => SyncBridge.Consultar?.Raise()));
        stack.Children.Add(Boton("Desconectar", cream, () => { ApiClient.Desconectar(); Refrescar(); }));

        stack.Children.Add(Label("Previsualización", gold));
        _preview = new System.Windows.Controls.TextBox
        {
            IsReadOnly = true,
            TextWrapping = TextWrapping.Wrap,
            AcceptsReturn = true,
            MinHeight = 220,
            FontFamily = new FontFamily("Consolas"),
            FontSize = 11,
            Background = new SolidColorBrush(Color.FromRgb(15, 33, 51)),
            Foreground = cream,
            BorderThickness = new Thickness(0),
            Padding = new Thickness(8),
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
        };
        stack.Children.Add(_preview);
        Content = new ScrollViewer { Content = stack, VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
        Refrescar();
    }

    public void SetupDockablePane(DockablePaneProviderData data)
    {
        data.FrameworkElement = this;
        data.InitialState = new DockablePaneState { DockPosition = DockPosition.Right };
    }

    public void Refrescar()
    {
        Dispatcher.BeginInvoke(new Action(() =>
        {
            _estado.Text = ApiClient.Conectado ? "● CONECTADO" : "● DESCONECTADO";
            var p = SyncBridge.UltimoPaquete;
            _detalle.Text =
                (ApiClient.State.Email.Length > 0 ? "Cuenta: " + ApiClient.State.Email + "\n" : "") +
                (p == null ? "Modelo: —\n" : "Modelo: " + p.Revit.Archivo + "\n") +
                (p == null ? "" : "Elementos: " + p.Elementos.Count + " · Categorías: " + p.Resumen.Count + "\n") +
                "Cambios pendientes: " + SyncBridge.Pendientes + "\n" +
                (SyncBridge.UltimoSync == null ? "Última sincronización: —" : "Última sincronización: " + SyncBridge.UltimoSync.Value.ToString("dd/MM/yyyy HH:mm")) +
                "\n" + SyncBridge.UltimoMensaje;
            _preview.Text = TextoPreview(p, SyncBridge.ConsultaTexto);
        }));
    }

    private static string TextoPreview(RevitPaquete? p, string consulta)
    {
        var sb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(consulta))
        {
            sb.AppendLine(consulta.Trim());
            sb.AppendLine();
        }
        if (p == null)
        {
            sb.Append("Pulse Analizar modelo para descubrir categorías, UniqueId y metrados.");
            return sb.ToString();
        }
        sb.AppendLine("ELEMENTOS DETECTADOS");
        foreach (var r in p.Resumen.Take(24))
            sb.AppendLine((r.Categoria + " ").PadRight(28, '.') + " " + r.N.ToString("N0", CultureInfo.InvariantCulture));
        if (p.Resumen.Count > 24) sb.AppendLine("… +" + (p.Resumen.Count - 24) + " categorías");
        sb.AppendLine();
        sb.AppendLine("METRADOS");
        foreach (var r in p.Resumen.Take(16))
        {
            var q = r.Cantidades.FirstOrDefault(c => c.Principal) ?? r.Cantidades.FirstOrDefault();
            if (q == null) continue;
            sb.AppendLine(r.Categoria + ": " + q.Valor.ToString("N2", CultureInfo.InvariantCulture) + " " + q.Und);
        }
        sb.AppendLine();
        sb.AppendLine("CAMBIOS");
        sb.AppendLine("Nuevos:      " + p.Cambios.Nuevos);
        sb.AppendLine("Modificados: " + p.Cambios.Modificados);
        sb.AppendLine("Eliminados:  " + p.Cambios.Eliminados);
        sb.AppendLine("Sin cambios: " + p.Cambios.Iguales);
        return sb.ToString();
    }

    private async void Conectar()
    {
        try
        {
            var (ok, msg) = await ApiClient.Reclamar(_api.Text.Trim(), _codigo.Text.Trim()).ConfigureAwait(true);
            SyncBridge.UltimoMensaje = msg;
            LocalCache.Log(ok ? "conectado" : "conectar fail");
            if (ok) _codigo.Text = "";
        }
        catch (Exception ex)
        {
            SyncBridge.UltimoMensaje = ex.Message;
        }
        Refrescar();
    }

    private static TextBlock Label(string t, Brush color) =>
        new() { Text = t, Foreground = color, FontSize = 11, Margin = new Thickness(0, 0, 0, 4) };

    private static Button Boton(string t, Brush fondo, Action click)
    {
        var b = new Button { Content = t, Margin = new Thickness(0, 0, 0, 8), Padding = new Thickness(8), Background = fondo, BorderThickness = new Thickness(0) };
        b.Click += (_, __) => click();
        return b;
    }
}

[Autodesk.Revit.Attributes.Transaction(Autodesk.Revit.Attributes.TransactionMode.Manual)]
public sealed class TogglePaneCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, Autodesk.Revit.DB.ElementSet elements)
    {
        try
        {
            var pane = commandData.Application.GetDockablePane(App.PaneId);
            if (pane.IsShown()) pane.Hide();
            else pane.Show();
            return Result.Succeeded;
        }
        catch (Exception ex)
        {
            message = ex.Message;
            TaskDialog.Show("MemoriaCalc", "No se pudo mostrar el panel. Cierre y abra Revit después de instalar.\n" + ex.Message);
            return Result.Failed;
        }
    }
}
