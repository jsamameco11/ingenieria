using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
using Autodesk.Revit.DB.Electrical;
using Autodesk.Revit.DB.Mechanical;
using Autodesk.Revit.DB.Plumbing;
using Autodesk.Revit.DB.Structure;
using MemoriaCalc.Revit.Core;

namespace MemoriaCalc.Revit;

internal static class Unidades
{
    public static double M(double internalFeet) => UnitUtils.ConvertFromInternalUnits(internalFeet, UnitTypeId.Meters);
    public static double M2(double internalArea) => UnitUtils.ConvertFromInternalUnits(internalArea, UnitTypeId.SquareMeters);
    public static double M3(double internalVol) => UnitUtils.ConvertFromInternalUnits(internalVol, UnitTypeId.CubicMeters);

    public static long IdVal(ElementId? id)
    {
        if (id == null) return -1;
#if REVIT2025 || REVIT2026
        return id.Value;
#else
        try { return id.IntegerValue; }
        catch { return -1; }
#endif
    }

    public static BuiltInCategory CategoriaDe(Element el)
    {
        if (el.Category == null) return BuiltInCategory.INVALID;
        try { return (BuiltInCategory)IdVal(el.Category.Id); }
        catch { return BuiltInCategory.INVALID; }
    }
}

internal static class ParameterExtractionService
{
    private static readonly string[] Preferidos =
    {
        "Código", "Codigo", "Code", "Partida", "Código Partida", "Codigo Partida",
        "Sector", "Bloque", "Piso", "Frente", "Zona", "Especialidad", "Material",
        "Mark", "Comments", "Manufacturer", "Model", "Type Mark", "Description",
    };

    public static Dictionary<string, string> Leer(Element el, ElementType? tipo)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var nombre in Preferidos)
        {
            var v = Texto(el.LookupParameter(nombre) ?? tipo?.LookupParameter(nombre));
            if (!string.IsNullOrWhiteSpace(v)) map[nombre] = v;
        }
        Recoger(el, map, 40);
        if (tipo != null) Recoger(tipo, map, 50);
        return map;
    }

    private static void Recoger(Element el, Dictionary<string, string> map, int tope)
    {
        foreach (Parameter p in el.Parameters)
        {
            if (map.Count >= tope) return;
            if (p == null || !p.HasValue) continue;
            var nombre = p.Definition?.Name;
            if (string.IsNullOrWhiteSpace(nombre) || map.ContainsKey(nombre)) continue;
            if (nombre.StartsWith("API ", StringComparison.OrdinalIgnoreCase)) continue;
            var v = Texto(p);
            if (string.IsNullOrWhiteSpace(v) || v.Length > 180) continue;
            map[nombre] = v;
        }
    }

    public static string Texto(Parameter? p)
    {
        if (p == null || !p.HasValue) return "";
        try
        {
            var s = p.AsValueString();
            if (!string.IsNullOrWhiteSpace(s)) return s.Trim();
            s = p.AsString();
            return string.IsNullOrWhiteSpace(s) ? "" : s.Trim();
        }
        catch { return ""; }
    }
}

internal static class GeometryExtractionService
{
    public static (double dx, double dy, double dz) Caja(Element el)
    {
        var bb = el.get_BoundingBox(null);
        if (bb == null) return (0, 0, 0);
        return (Unidades.M(Math.Abs(bb.Max.X - bb.Min.X)), Unidades.M(Math.Abs(bb.Max.Y - bb.Min.Y)), Unidades.M(Math.Abs(bb.Max.Z - bb.Min.Z)));
    }
}

internal sealed class PiezaScan
{
    public ElementoSync Sync = new();
    public Dictionary<string, double> CamposWeb = new();
    public string Rol = "desconocido";
    public string Clase = "otro";
    public double? Fc;
}

internal static class QuantityExtractionService
{
    public static void Add(List<CantidadValor> list, string clave, double valor, string und, bool principal = false)
    {
        if (valor <= 0.0005 && clave != "unidad") return;
        if (list.Exists(x => x.Clave == clave && x.Und == und))
        {
            var i = list.FindIndex(x => x.Clave == clave && x.Und == und);
            if (valor > list[i].Valor) list[i].Valor = Math.Round(valor, und == "kg" ? 1 : 3);
            if (principal) list[i].Principal = true;
            return;
        }
        list.Add(new CantidadValor { Clave = clave, Valor = Math.Round(valor, und == "kg" ? 1 : 3), Und = und, Principal = principal });
    }

    public static double ParamM(Element el, BuiltInParameter bip)
    {
        var p = el.get_Parameter(bip);
        if (p == null || !p.HasValue) return 0;
        return Unidades.M(p.AsDouble());
    }

    public static double ParamM2(Element el, BuiltInParameter bip)
    {
        var p = el.get_Parameter(bip);
        if (p == null || !p.HasValue) return 0;
        return Unidades.M2(p.AsDouble());
    }

    public static double ParamM3(Element el, BuiltInParameter bip)
    {
        var p = el.get_Parameter(bip);
        if (p == null || !p.HasValue) return 0;
        return Unidades.M3(p.AsDouble());
    }
}

internal static class CategoryDiscovery
{
    public static bool EsModelo(Category? cat)
    {
        if (cat == null) return false;
        if (cat.CategoryType == CategoryType.Model) return true;
        var n = cat.Name ?? "";
        return n.IndexOf("Room", StringComparison.OrdinalIgnoreCase) >= 0
            || n.IndexOf("Habitaci", StringComparison.OrdinalIgnoreCase) >= 0
            || n.IndexOf("Space", StringComparison.OrdinalIgnoreCase) >= 0
            || n.IndexOf("Area", StringComparison.OrdinalIgnoreCase) >= 0;
    }

    public static string Disciplina(string categoria)
    {
        var c = (categoria ?? "").ToLowerInvariant();
        if (c.Contains("duct") || c.Contains("mechanical") || c.Contains("air") || c.Contains("hvac") || c.Contains("sprinkler") || c.Contains("fire")) return "MEP";
        if (c.Contains("pipe") || c.Contains("plumbing") || c.Contains("sanit")) return "Sanitarias";
        if (c.Contains("electrical") || c.Contains("lighting") || c.Contains("conduit") || c.Contains("cable") || c.Contains("panel")) return "Eléctricas";
        if (c.Contains("data") || c.Contains("communication") || c.Contains("security") || c.Contains("telephone") || c.Contains("audio")) return "Comunicaciones";
        if (c.Contains("structural") || c.Contains("rebar") || c.Contains("fabric") || c.Contains("foundation") || c.Contains("armadura")) return "Estructuras";
        if (c.Contains("site") || c.Contains("topo") || c.Contains("plant") || c.Contains("parking") || c.Contains("hardscape")) return "Sitio";
        if (c.Contains("furniture") || c.Contains("specialt") || c.Contains("entour") || c.Contains("equip")) return "Equipamiento";
        return "Arquitectura";
    }
}

internal interface IElementExtractor
{
    bool Acepta(Element el);
    void Completar(Document doc, Element el, PiezaScan p);
}

internal static class ExtractorRegistry
{
    private static readonly IElementExtractor[] Especiales =
    {
        new WallExtractor(),
        new FloorExtractor(),
        new RoofCeilingExtractor(),
        new DoorWindowExtractor(),
        new StairRampExtractor(),
        new RailingExtractor(),
        new RoomSpaceExtractor(),
        new ColumnFramingExtractor(),
        new FoundationExtractor(),
        new RebarExtractor(),
        new PipeExtractor(),
        new DuctExtractor(),
        new RacewayExtractor(),
        new CountedFamilyExtractor(),
    };

    public static void Aplicar(Document doc, Element el, PiezaScan p)
    {
        foreach (var x in Especiales)
        {
            if (!x.Acepta(el)) continue;
            x.Completar(doc, el, p);
            return;
        }
    }
}

internal static class GenericExtractor
{
    public static PiezaScan Extraer(Document doc, Element el, string origen, string linkNombre)
    {
        var tipo = doc.GetElement(el.GetTypeId()) as ElementType;
        var cat = el.Category?.Name ?? "Sin categoría";
        var familia = tipo is FamilySymbol fs ? fs.FamilyName : (tipo?.FamilyName ?? cat);
        var tipoNom = tipo?.Name ?? el.Name ?? "";
        var material = MaterialDe(el);
        var clase = Clasificador.ClaseMaterial(material);
        var nivel = NivelDe(doc, el);
        var rol = Clasificador.Rol(familia, tipoNom, cat, nivel, material, clase);
        var vol = QuantityExtractionService.ParamM3(el, BuiltInParameter.HOST_VOLUME_COMPUTED);
        var area = QuantityExtractionService.ParamM2(el, BuiltInParameter.HOST_AREA_COMPUTED);
        var largo = QuantityExtractionService.ParamM(el, BuiltInParameter.CURVE_ELEM_LENGTH);
        if (largo <= 0) largo = QuantityExtractionService.ParamM(el, BuiltInParameter.INSTANCE_LENGTH_PARAM);
        var (dx, dy, dz) = GeometryExtractionService.Caja(el);
        if (area <= 0 && dx > 0 && dy > 0) area = dx * dy;
        if (vol <= 0 && area > 0 && dz > 0) vol = area * dz;
        var cants = new List<CantidadValor>();
        QuantityExtractionService.Add(cants, "longitud", largo, "m", largo > area && largo > vol);
        QuantityExtractionService.Add(cants, "area", area, "m²", area >= vol && area >= largo);
        QuantityExtractionService.Add(cants, "volumen", vol, "m³", vol > area && vol > largo);
        QuantityExtractionService.Add(cants, "ancho", Math.Min(dx, dy), "m");
        QuantityExtractionService.Add(cants, "alto", dz, "m");
        QuantityExtractionService.Add(cants, "unidad", 1, "und", cants.Count == 0);
        if (cants.TrueForAll(x => !x.Principal) && cants.Count > 0) cants[0].Principal = true;

        var campos = new Dictionary<string, double>();
        if (vol > 0.0005 && (clase.StartsWith("concreto") || EsConcreto(rol))) campos["concreto_m3"] = Math.Round(vol, 3);
        if (area > 0.0005) campos["area_planta_m2"] = Math.Round(area, 3);
        if (largo > 0.0005) campos["longitud_m"] = Math.Round(largo, 3);
        if (campos.Count == 0) campos["unidad_und"] = 1;

        var sync = new ElementoSync
        {
            UniqueId = el.UniqueId,
            ElementId = Unidades.IdVal(el.Id),
            Categoria = cat,
            Disciplina = CategoryDiscovery.Disciplina(cat),
            Familia = familia,
            Tipo = tipoNom,
            Marca = ParameterExtractionService.Texto(el.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)),
            Nivel = nivel,
            Material = material,
            Fase = ParameterExtractionService.Texto(el.get_Parameter(BuiltInParameter.PHASE_CREATED)),
            Workset = ParameterExtractionService.Texto(el.get_Parameter(BuiltInParameter.ELEM_PARTITION_PARAM)),
            Sistema = ParameterExtractionService.Texto(el.get_Parameter(BuiltInParameter.RBS_SYSTEM_NAME_PARAM)),
            Origen = origen,
            LinkNombre = linkNombre,
            Cantidades = cants,
            Parametros = ParameterExtractionService.Leer(el, tipo),
        };
        sync.Hash = HashDe(sync, campos);
        var pieza = new PiezaScan { Sync = sync, CamposWeb = campos, Rol = rol, Clase = clase, Fc = Clasificador.Fc(material, tipoNom) };
        ExtractorRegistry.Aplicar(doc, el, pieza);
        sync.Hash = HashDe(sync, pieza.CamposWeb);
        return pieza;
    }

    private static bool EsConcreto(string rol) =>
        rol is "zapata" or "dado" or "columna" or "viga" or "viga_cimentacion" or "losa_aligerada"
            or "losa_maciza" or "escalera" or "placa" or "muro_concreto" or "cisterna" or "cimiento_corrido"
            or "sobrecimiento" or "solado";

    private static string MaterialDe(Element el)
    {
        var p = el.get_Parameter(BuiltInParameter.STRUCTURAL_MATERIAL_PARAM) ?? el.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM);
        return ParameterExtractionService.Texto(p);
    }

    private static string NivelDe(Document doc, Element el)
    {
        if (el.LevelId != ElementId.InvalidElementId)
        {
            var lv = doc.GetElement(el.LevelId);
            if (lv != null) return lv.Name;
        }
        var p = el.get_Parameter(BuiltInParameter.SCHEDULE_LEVEL_PARAM)
            ?? el.get_Parameter(BuiltInParameter.INSTANCE_REFERENCE_LEVEL_PARAM);
        if (p != null && p.HasValue)
        {
            var lv = doc.GetElement(p.AsElementId());
            if (lv != null) return lv.Name;
            var t = p.AsValueString();
            if (!string.IsNullOrWhiteSpace(t)) return t;
        }
        return "";
    }

    internal static string HashDe(ElementoSync s, Dictionary<string, double> campos)
    {
        var raw = s.UniqueId + "|" + s.Categoria + "|" + s.Familia + "|" + s.Tipo + "|" + s.Nivel + "|" +
                  string.Join(",", campos.OrderBy(k => k.Key).Select(k => k.Key + "=" + k.Value.ToString("0.###", CultureInfo.InvariantCulture)));
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
        return BitConverter.ToString(bytes, 0, 8).Replace("-", "");
    }
}

internal sealed class WallExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is Wall;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var wall = (Wall)el;
        var L = QuantityExtractionService.ParamM(wall, BuiltInParameter.CURVE_ELEM_LENGTH);
        var H = QuantityExtractionService.ParamM(wall, BuiltInParameter.WALL_USER_HEIGHT_PARAM);
        var W = Unidades.M(wall.Width);
        QuantityExtractionService.Add(p.Sync.Cantidades, "espesor", W, "m");
        QuantityExtractionService.Add(p.Sync.Cantidades, "altura", H, "m");
        if (L > 0) p.CamposWeb["longitud_m"] = Math.Round(L, 3);
        _ = doc;
    }
}

internal sealed class FloorExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is Floor;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var tipo = doc.GetElement(el.GetTypeId());
        var e = tipo == null ? 0 : QuantityExtractionService.ParamM(tipo, BuiltInParameter.FLOOR_ATTR_THICKNESS_PARAM);
        QuantityExtractionService.Add(p.Sync.Cantidades, "espesor", e, "m");
    }
}

internal sealed class RoofCeilingExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is RoofBase || el is Ceiling;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var area = QuantityExtractionService.ParamM2(el, BuiltInParameter.HOST_AREA_COMPUTED);
        if (area > 0) p.CamposWeb["area_planta_m2"] = Math.Round(area, 3);
        _ = doc;
    }
}

internal sealed class DoorWindowExtractor : IElementExtractor
{
    public bool Acepta(Element el)
    {
        var c = Unidades.CategoriaDe(el);
        return c is BuiltInCategory.OST_Doors or BuiltInCategory.OST_Windows;
    }
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        p.CamposWeb.Clear();
        p.CamposWeb["unidad_und"] = 1;
        QuantityExtractionService.Add(p.Sync.Cantidades, "unidad", 1, "und", true);
        _ = doc;
    }
}

internal sealed class StairRampExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is Stairs || Unidades.CategoriaDe(el) == BuiltInCategory.OST_Ramps;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        QuantityExtractionService.Add(p.Sync.Cantidades, "tramos", 1, "und");
        _ = doc;
    }
}

internal sealed class RailingExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is Railing;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var L = QuantityExtractionService.ParamM(el, BuiltInParameter.CURVE_ELEM_LENGTH);
        if (L > 0)
        {
            p.CamposWeb.Clear();
            p.CamposWeb["longitud_m"] = Math.Round(L, 3);
        }
        _ = doc;
    }
}

internal sealed class RoomSpaceExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is Room || el is Space || el is Area;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        p.CamposWeb.Clear();
        if (el is Room room) p.CamposWeb["area_planta_m2"] = Math.Round(Unidades.M2(room.Area), 3);
        else if (el is Space space) p.CamposWeb["area_planta_m2"] = Math.Round(Unidades.M2(space.Area), 3);
        else if (el is Area area) p.CamposWeb["area_planta_m2"] = Math.Round(Unidades.M2(area.Area), 3);
        _ = doc;
    }
}

internal sealed class ColumnFramingExtractor : IElementExtractor
{
    public bool Acepta(Element el)
    {
        var c = Unidades.CategoriaDe(el);
        return c is BuiltInCategory.OST_StructuralColumns or BuiltInCategory.OST_StructuralFraming;
    }
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var L = QuantityExtractionService.ParamM(el, BuiltInParameter.INSTANCE_LENGTH_PARAM);
        if (L <= 0) L = QuantityExtractionService.ParamM(el, BuiltInParameter.CURVE_ELEM_LENGTH);
        if (L > 0) p.CamposWeb["longitud_m"] = Math.Round(L, 3);
        _ = doc;
    }
}

internal sealed class FoundationExtractor : IElementExtractor
{
    public bool Acepta(Element el)
    {
        var c = Unidades.CategoriaDe(el);
        return c is BuiltInCategory.OST_StructuralFoundation;
    }
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var vol = QuantityExtractionService.ParamM3(el, BuiltInParameter.HOST_VOLUME_COMPUTED);
        if (vol > 0) p.CamposWeb["concreto_m3"] = Math.Round(vol, 3);
        _ = doc;
    }
}

internal sealed class RebarExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is Rebar;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var kg = AceroKg((Rebar)el);
        p.CamposWeb.Clear();
        if (kg > 0) p.CamposWeb["acero_kg"] = Math.Round(kg, 1);
        p.Rol = "acero_suelto";
        QuantityExtractionService.Add(p.Sync.Cantidades, "acero", kg, "kg", true);
        _ = doc;
    }

    private static double AceroKg(Rebar rebar)
    {
        var vol = rebar.LookupParameter("Volume") ?? rebar.LookupParameter("Volumen");
        if (vol != null && vol.HasValue && vol.AsDouble() > 0)
            return Unidades.M3(vol.AsDouble()) * 7850;
        var largo = rebar.get_Parameter(BuiltInParameter.REBAR_ELEM_TOTAL_LENGTH);
        var diam = rebar.get_Parameter(BuiltInParameter.REBAR_BAR_DIAMETER);
        var qty = rebar.get_Parameter(BuiltInParameter.REBAR_ELEM_QUANTITY_OF_BARS);
        if (largo == null || !largo.HasValue || diam == null || !diam.HasValue) return 0;
        var n = qty != null && qty.HasValue ? Math.Max(1, qty.AsInteger()) : 1;
        var L = Unidades.M(largo.AsDouble());
        var d = Unidades.M(diam.AsDouble());
        return n * L * Math.PI * (d * d / 4.0) * 7850;
    }
}

internal sealed class PipeExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is Pipe || el is FlexPipe;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var L = QuantityExtractionService.ParamM(el, BuiltInParameter.CURVE_ELEM_LENGTH);
        p.CamposWeb.Clear();
        if (L > 0) p.CamposWeb["longitud_m"] = Math.Round(L, 3);
        else p.CamposWeb["unidad_und"] = 1;
        var d = QuantityExtractionService.ParamM(el, BuiltInParameter.RBS_PIPE_DIAMETER_PARAM);
        QuantityExtractionService.Add(p.Sync.Cantidades, "diametro", d, "m");
        _ = doc;
    }
}

internal sealed class DuctExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is Duct || el is FlexDuct;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var L = QuantityExtractionService.ParamM(el, BuiltInParameter.CURVE_ELEM_LENGTH);
        p.CamposWeb.Clear();
        if (L > 0) p.CamposWeb["longitud_m"] = Math.Round(L, 3);
        else p.CamposWeb["unidad_und"] = 1;
        _ = doc;
    }
}

internal sealed class RacewayExtractor : IElementExtractor
{
    public bool Acepta(Element el) => el is Conduit || el is CableTray;
    public void Completar(Document doc, Element el, PiezaScan p)
    {
        var L = QuantityExtractionService.ParamM(el, BuiltInParameter.CURVE_ELEM_LENGTH);
        p.CamposWeb.Clear();
        if (L > 0) p.CamposWeb["longitud_m"] = Math.Round(L, 3);
        else p.CamposWeb["unidad_und"] = 1;
        _ = doc;
    }
}

internal sealed class CountedFamilyExtractor : IElementExtractor
{
    public bool Acepta(Element el)
    {
        if (el is not FamilyInstance) return false;
        var c = Unidades.CategoriaDe(el);
        return c is BuiltInCategory.OST_PlumbingFixtures
            or BuiltInCategory.OST_MechanicalEquipment
            or BuiltInCategory.OST_ElectricalEquipment
            or BuiltInCategory.OST_ElectricalFixtures
            or BuiltInCategory.OST_LightingFixtures
            or BuiltInCategory.OST_LightingDevices
            or BuiltInCategory.OST_Furniture
            or BuiltInCategory.OST_FurnitureSystems
            or BuiltInCategory.OST_SpecialityEquipment
            or BuiltInCategory.OST_Sprinklers
            or BuiltInCategory.OST_DataDevices
            or BuiltInCategory.OST_CommunicationDevices
            or BuiltInCategory.OST_SecurityDevices
            or BuiltInCategory.OST_FireAlarmDevices
            or BuiltInCategory.OST_NurseCallDevices
            or BuiltInCategory.OST_TelephoneDevices;
    }

    public void Completar(Document doc, Element el, PiezaScan p)
    {
        p.CamposWeb.Clear();
        p.CamposWeb["unidad_und"] = 1;
        QuantityExtractionService.Add(p.Sync.Cantidades, "unidad", 1, "und", true);
        _ = doc;
    }
}
