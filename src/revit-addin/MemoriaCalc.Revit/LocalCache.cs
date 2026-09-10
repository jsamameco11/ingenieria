using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Autodesk.Revit.DB;

namespace MemoriaCalc.Revit;

internal static class LocalCache
{
    private static string Dir()
    {
        var d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MemoriaCalc", "revit");
        Directory.CreateDirectory(d);
        return d;
    }

    private static string PathDe(Document doc) =>
        Path.Combine(Dir(), "cache-" + Sanitize(ModeloScanner.ModelIdDe(doc)) + ".json");

    public static Dictionary<string, string> Leer(Document doc)
    {
        try
        {
            var p = PathDe(doc);
            if (!File.Exists(p)) return new Dictionary<string, string>();
            return JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(p)) ?? new Dictionary<string, string>();
        }
        catch { return new Dictionary<string, string>(); }
    }

    public static void Escribir(Document doc, Dictionary<string, string> hashes)
    {
        try { File.WriteAllText(PathDe(doc), JsonSerializer.Serialize(hashes)); }
        catch { /* cache local no es crítica */ }
    }

    public static string DevicePath() => Path.Combine(Dir(), "device.json");

    public static string PendingPath() => Path.Combine(Dir(), "pending.json");

    public static string LogPath() => Path.Combine(Dir(), "addin.log");

    public static void Log(string linea)
    {
        try
        {
            var t = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + (linea ?? "").Replace("\r", " ").Replace("\n", " ");
            if (t.IndexOf("Bearer", StringComparison.OrdinalIgnoreCase) >= 0) return;
            File.AppendAllText(LogPath(), t + Environment.NewLine);
        }
        catch { /* log local */ }
    }

    private static string Sanitize(string s)
    {
        foreach (var c in Path.GetInvalidFileNameChars()) s = s.Replace(c, '-');
        return s;
    }
}
