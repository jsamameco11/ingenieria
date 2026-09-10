using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;

namespace MemoriaCalc.Revit.Setup;

internal sealed class SetupForm : Form
{
    private const string Version = "2.0.0";
    private readonly Label _estado;
    private readonly Button _instalar;
    private readonly Button _quitar;

    public SetupForm()
    {
        Text = "MemoriaCalc · Plugin para Autodesk Revit";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(520, 420);
        BackColor = Color.FromArgb(18, 38, 58);
        ForeColor = Color.FromArgb(232, 224, 210);
        Font = new Font("Segoe UI", 10);

        var titulo = new Label
        {
            Text = "MemoriaCalc para Revit",
            Font = new Font("Georgia", 20, FontStyle.Bold),
            ForeColor = Color.White,
            Location = new Point(28, 24),
            AutoSize = true,
        };
        var sub = new Label
        {
            Text = "Plugin oficial · versión " + Version + " · Revit 2023 a 2026",
            ForeColor = Color.FromArgb(196, 160, 86),
            Location = new Point(30, 64),
            AutoSize = true,
        };
        var cuerpo = new Label
        {
            Text =
                "Instala el add-in de Autodesk Revit (API nativa, no es un script).\n" +
                "Al abrir Revit verá la cinta MemoriaCalc y el panel Conector BIM.\n" +
                "Ese panel se muestra u oculta y sincroniza metrados con la web.\n\n" +
                "No pide administrador. Se instala en su perfil de Windows.",
            Location = new Point(30, 98),
            Size = new Size(460, 88),
        };
        _estado = new Label
        {
            Text = Detectar(),
            Location = new Point(30, 196),
            Size = new Size(460, 88),
            ForeColor = Color.FromArgb(201, 192, 176),
        };
        _instalar = Boton("Instalar plugin", 30, 300, Color.FromArgb(196, 160, 86), Color.FromArgb(18, 38, 58), Instalar);
        _quitar = Boton("Desinstalar", 220, 300, Color.FromArgb(15, 33, 51), Color.FromArgb(232, 224, 210), Quitar);
        var cerrar = Boton("Cerrar", 380, 300, Color.FromArgb(15, 33, 51), Color.FromArgb(232, 224, 210), (_, __) => Close());
        var pie = new Label
        {
            Text = "Tras instalar, abra Revit. Si Revit está abierto, ciérrelo y ábralo de nuevo.",
            Location = new Point(30, 356),
            Size = new Size(460, 40),
            ForeColor = Color.FromArgb(169, 160, 144),
        };

        Controls.AddRange(new Control[] { titulo, sub, cuerpo, _estado, _instalar, _quitar, cerrar, pie });
    }

    private static Button Boton(string texto, int x, int y, Color fondo, Color frente, EventHandler click)
    {
        var b = new Button
        {
            Text = texto,
            Location = new Point(x, y),
            Size = new Size(170, 40),
            FlatStyle = FlatStyle.Flat,
            BackColor = fondo,
            ForeColor = frente,
            Cursor = Cursors.Hand,
        };
        b.FlatAppearance.BorderColor = Color.FromArgb(196, 160, 86);
        b.Click += click;
        return b;
    }

    private static string Destino() =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Autodesk", "ApplicationPlugins", "MemoriaCalc.bundle");

    private static string Detectar()
    {
        var años = new[] { 2023, 2024, 2025, 2026 }
            .Where(y => Directory.Exists(@"C:\Program Files\Autodesk\Revit " + y))
            .Select(y => y.ToString())
            .ToArray();
        var instalado = Directory.Exists(Destino());
        var revit = Process.GetProcessesByName("Revit").Length > 0;
        return
            (años.Length > 0 ? "Revit detectado: " + string.Join(", ", años) : "No se encontró Revit en Program Files. Puede instalar el plugin de todos modos.") +
            "\n" + (instalado ? "Estado: plugin ya instalado." : "Estado: pendiente de instalar.") +
            (revit ? "\nRevit está abierto: ciérrelo después de instalar." : "");
    }

    private void Instalar(object? sender, EventArgs e)
    {
        try
        {
            var dest = Destino();
            if (Directory.Exists(dest)) Directory.Delete(dest, true);
            Directory.CreateDirectory(dest);
            ExtraerBundle(dest);
            LimpiarLegacy();
            _estado.Text = "Plugin instalado.\n" + dest + "\nAbra Autodesk Revit para cargarlo.";
            _estado.ForeColor = Color.FromArgb(196, 214, 180);
        }
        catch (Exception ex)
        {
            _estado.Text = "No se pudo instalar.\n" + ex.Message;
            _estado.ForeColor = Color.FromArgb(220, 160, 150);
        }
    }

    private void Quitar(object? sender, EventArgs e)
    {
        try
        {
            var dest = Destino();
            if (Directory.Exists(dest)) Directory.Delete(dest, true);
            LimpiarLegacy();
            _estado.Text = "Plugin desinstalado. Ya no se cargará al abrir Revit.";
            _estado.ForeColor = Color.FromArgb(196, 214, 180);
        }
        catch (Exception ex)
        {
            _estado.Text = "No se pudo desinstalar.\n" + ex.Message;
            _estado.ForeColor = Color.FromArgb(220, 160, 150);
        }
    }

    private static void ExtraerBundle(string dest)
    {
        var asm = Assembly.GetExecutingAssembly();
        var name = asm.GetManifestResourceNames().FirstOrDefault(n => n.EndsWith("bundle.zip", StringComparison.OrdinalIgnoreCase));
        if (name == null) throw new InvalidOperationException("El instalador no incluye el bundle del plugin.");
        using var stream = asm.GetManifestResourceStream(name);
        if (stream == null) throw new InvalidOperationException("No se pudo leer el bundle embebido.");
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read);
        zip.ExtractToDirectory(dest);
        if (!File.Exists(Path.Combine(dest, "PackageContents.xml")))
            throw new InvalidOperationException("El bundle no tiene PackageContents.xml.");
    }

    private static void LimpiarLegacy()
    {
        foreach (var year in new[] { "2023", "2024", "2025", "2026" })
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Autodesk", "Revit", "Addins", year);
            foreach (var f in new[] { "MemoriaCalc.Revit.addin", "MemoriaCalc.Revit.dll", "MemoriaCalc.Revit.Core.dll" })
            {
                var p = Path.Combine(dir, f);
                if (File.Exists(p)) File.Delete(p);
            }
        }
    }
}
