using System.Text.RegularExpressions;

namespace MemoriaCalc.Revit;

internal static class Clasificador
{
    public static string Rol(string familia, string tipo, string categoria, string nivel, string material, string clase)
    {
        var blob = $"{familia} {tipo} {categoria} {nivel}".ToLowerInvariant();
        if (clase == "albanileria") return "albanileria";
        if (clase == "acero" && Regex.IsMatch(blob, @"rebar|armadura")) return "acero_suelto";
        if (Regex.IsMatch(blob, @"zapata|footing")) return "zapata";
        if (Regex.IsMatch(blob, @"dado|pedestal")) return "dado";
        if (Regex.IsMatch(blob, @"ciment|grade.?beam|amarre")) return "viga_cimentacion";
        if (Regex.IsMatch(blob, @"sobrecimiento|stem")) return "sobrecimiento";
        if (Regex.IsMatch(blob, @"cimiento|corrido")) return "cimiento_corrido";
        if (Regex.IsMatch(blob, @"column|pilar|columna") || blob.Contains("structuralcolumns")) return "columna";
        if (Regex.IsMatch(blob, @"placa|shear|muro de corte")) return "placa";
        if (Regex.IsMatch(blob, @"escalera|stair")) return "escalera";
        if (Regex.IsMatch(blob, @"cisterna|tanque|reservorio")) return "cisterna";
        if (Regex.IsMatch(blob, @"aliger|nervad|vigueta|waffle|rib")) return "losa_aligerada";
        if (Regex.IsMatch(blob, @"maciza|solid|flat.?slab")) return "losa_maciza";
        if (Regex.IsMatch(blob, @"viga|beam|framing")) return "viga";
        if (Regex.IsMatch(blob, @"losa|floor")) return "losa_maciza";
        if (Regex.IsMatch(blob, @"muro|wall") && clase.StartsWith("concreto")) return "muro_concreto";
        if (Regex.IsMatch(blob, @"solado|falso piso")) return "solado";
        if (categoria.IndexOf("Structural Columns", System.StringComparison.OrdinalIgnoreCase) >= 0) return "columna";
        if (categoria.IndexOf("Structural Framing", System.StringComparison.OrdinalIgnoreCase) >= 0) return "viga";
        if (categoria.IndexOf("Structural Foundations", System.StringComparison.OrdinalIgnoreCase) >= 0) return "zapata";
        if (categoria.IndexOf("Stairs", System.StringComparison.OrdinalIgnoreCase) >= 0) return "escalera";
        if (categoria.IndexOf("Walls", System.StringComparison.OrdinalIgnoreCase) >= 0)
            return clase == "albanileria" ? "albanileria" : clase.StartsWith("concreto") ? "muro_concreto" : "desconocido";
        if (categoria.IndexOf("Floors", System.StringComparison.OrdinalIgnoreCase) >= 0) return "losa_maciza";
        return "desconocido";
    }

    public static string ClaseMaterial(string name)
    {
        var t = (name ?? "").ToLowerInvariant();
        if (Regex.IsMatch(t, @"ladrillo|kk|pandereta|masonry|albañ|albanil")) return "albanileria";
        if (Regex.IsMatch(t, @"acero|steel|fy\s*4") && !Regex.IsMatch(t, @"concreto|hormig")) return "acero";
        if (Regex.IsMatch(t, @"madera|wood")) return "madera";
        if (Regex.IsMatch(t, @"simple|ciclop|fc\s*100|f'c\s*100")) return "concreto_simple";
        if (Regex.IsMatch(t, @"concreto|hormig|concrete")) return "concreto_armado";
        return "otro";
    }

    public static double? Fc(string material, string tipo)
    {
        var m = Regex.Match($"{material} {tipo}", @"f'?c\s*[=:]?\s*(\d{2,3})", RegexOptions.IgnoreCase);
        if (m.Success && double.TryParse(m.Groups[1].Value, out var fc)) return fc;
        return null;
    }

    public static string Confianza(string rol, string categoria)
    {
        if (rol == "desconocido") return "baja";
        if (categoria.IndexOf("Structural", System.StringComparison.OrdinalIgnoreCase) >= 0) return "alta";
        return "media";
    }
}
