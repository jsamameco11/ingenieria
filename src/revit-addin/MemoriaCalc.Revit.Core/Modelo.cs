using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MemoriaCalc.Revit.Core;

public static class AddinInfo
{
    public const string Version = "2.0.0";
    public const string Schema = "memoriacalc.revit.v1";
    public const string ApiVersion = "v1";
    public const string Vendor = "MemoriaCalc";
    public const string ProductUrl = "https://ingenieria.miacademiapreu.com";
    public const string UpdateManifest = "https://ingenieria.miacademiapreu.com/addin/release.json";
    public const string DefaultApi = "https://ingenieria.miacademiapreu.com";
}

public sealed class RevitPaquete
{
    [JsonPropertyName("schema")]
    public string Schema { get; set; } = AddinInfo.Schema;

    [JsonPropertyName("paqueteId")]
    public string PaqueteId { get; set; } = Guid.NewGuid().ToString();

    [JsonPropertyName("modelId")]
    public string ModelId { get; set; } = "";

    [JsonPropertyName("exportadoEn")]
    public string ExportadoEn { get; set; } = DateTime.UtcNow.ToString("o");

    [JsonPropertyName("addinVersion")]
    public string AddinVersion { get; set; } = AddinInfo.Version;

    [JsonPropertyName("revit")]
    public RevitMeta Revit { get; set; } = new();

    [JsonPropertyName("obra")]
    public ObraMeta Obra { get; set; } = new();

    [JsonPropertyName("resumen")]
    public List<ResumenCategoria> Resumen { get; set; } = new();

    [JsonPropertyName("cambios")]
    public CambioResumen Cambios { get; set; } = new();

    [JsonPropertyName("elementos")]
    public List<ElementoSync> Elementos { get; set; } = new();

    [JsonPropertyName("grupos")]
    public List<RevitGrupo> Grupos { get; set; } = new();

    [JsonPropertyName("omitidos")]
    public List<Omitido> Omitidos { get; set; } = new();

    [JsonPropertyName("eliminados")]
    public List<string> Eliminados { get; set; } = new();
}

public sealed class RevitMeta
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = "";

    [JsonPropertyName("archivo")]
    public string Archivo { get; set; } = "";

    [JsonPropertyName("modelId")]
    public string ModelId { get; set; } = "";
}

public sealed class ObraMeta
{
    [JsonPropertyName("nombre")]
    public string Nombre { get; set; } = "";
}

public sealed class Omitido
{
    [JsonPropertyName("uniqueId")]
    public string UniqueId { get; set; } = "";

    [JsonPropertyName("motivo")]
    public string Motivo { get; set; } = "";
}

public sealed class ResumenCategoria
{
    [JsonPropertyName("categoria")]
    public string Categoria { get; set; } = "";

    [JsonPropertyName("n")]
    public int N { get; set; }

    [JsonPropertyName("cantidades")]
    public List<CantidadValor> Cantidades { get; set; } = new();
}

public sealed class CambioResumen
{
    [JsonPropertyName("nuevos")]
    public int Nuevos { get; set; }

    [JsonPropertyName("modificados")]
    public int Modificados { get; set; }

    [JsonPropertyName("eliminados")]
    public int Eliminados { get; set; }

    [JsonPropertyName("iguales")]
    public int Iguales { get; set; }
}

public sealed class CantidadValor
{
    [JsonPropertyName("clave")]
    public string Clave { get; set; } = "";

    [JsonPropertyName("valor")]
    public double Valor { get; set; }

    [JsonPropertyName("und")]
    public string Und { get; set; } = "";

    [JsonPropertyName("principal")]
    public bool Principal { get; set; }
}

public sealed class ElementoSync
{
    [JsonPropertyName("uniqueId")]
    public string UniqueId { get; set; } = "";

    [JsonPropertyName("elementId")]
    public long ElementId { get; set; }

    [JsonPropertyName("categoria")]
    public string Categoria { get; set; } = "";

    [JsonPropertyName("disciplina")]
    public string Disciplina { get; set; } = "";

    [JsonPropertyName("familia")]
    public string Familia { get; set; } = "";

    [JsonPropertyName("tipo")]
    public string Tipo { get; set; } = "";

    [JsonPropertyName("marca")]
    public string Marca { get; set; } = "";

    [JsonPropertyName("nivel")]
    public string Nivel { get; set; } = "";

    [JsonPropertyName("material")]
    public string Material { get; set; } = "";

    [JsonPropertyName("fase")]
    public string Fase { get; set; } = "";

    [JsonPropertyName("workset")]
    public string Workset { get; set; } = "";

    [JsonPropertyName("sistema")]
    public string Sistema { get; set; } = "";

    [JsonPropertyName("origen")]
    public string Origen { get; set; } = "host";

    [JsonPropertyName("linkNombre")]
    public string LinkNombre { get; set; } = "";

    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "unchanged";

    [JsonPropertyName("hash")]
    public string Hash { get; set; } = "";

    [JsonPropertyName("cantidades")]
    public List<CantidadValor> Cantidades { get; set; } = new();

    [JsonPropertyName("parametros")]
    public Dictionary<string, string> Parametros { get; set; } = new();
}

public sealed class RevitGrupo
{
    [JsonPropertyName("grupoId")]
    public string GrupoId { get; set; } = "";

    [JsonPropertyName("rol")]
    public string Rol { get; set; } = "desconocido";

    [JsonPropertyName("categoriaRevit")]
    public string CategoriaRevit { get; set; } = "";

    [JsonPropertyName("familia")]
    public string Familia { get; set; } = "";

    [JsonPropertyName("tipo")]
    public string Tipo { get; set; } = "";

    [JsonPropertyName("material")]
    public string Material { get; set; } = "";

    [JsonPropertyName("claseMaterial")]
    public string ClaseMaterial { get; set; } = "otro";

    [JsonPropertyName("fc")]
    public double? Fc { get; set; }

    [JsonPropertyName("nivel")]
    public string Nivel { get; set; } = "";

    [JsonPropertyName("nElementos")]
    public int NElementos { get; set; }

    [JsonPropertyName("uniqueIds")]
    public List<string> UniqueIds { get; set; } = new();

    [JsonPropertyName("cantidades")]
    public Dictionary<string, double> Cantidades { get; set; } = new();

    [JsonPropertyName("elementos")]
    public List<RevitElemento> Elementos { get; set; } = new();

    [JsonPropertyName("confianzaClasificacion")]
    public string ConfianzaClasificacion { get; set; } = "alta";

    [JsonPropertyName("motivo")]
    public List<string> Motivo { get; set; } = new();

    [JsonPropertyName("addinVersion")]
    public string AddinVersion { get; set; } = AddinInfo.Version;
}

public sealed class RevitElemento
{
    [JsonPropertyName("uniqueId")]
    public string UniqueId { get; set; } = "";

    [JsonPropertyName("marca")]
    public string Marca { get; set; } = "";

    [JsonPropertyName("tipo")]
    public string Tipo { get; set; } = "";

    [JsonPropertyName("nivel")]
    public string Nivel { get; set; } = "";

    [JsonPropertyName("cantidades")]
    public Dictionary<string, double> Cantidades { get; set; } = new();
}

public static class PaqueteBuilder
{
    public static string ToJson(RevitPaquete paquete) =>
        JsonSerializer.Serialize(paquete, new JsonSerializerOptions
        {
            WriteIndented = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        });
}
