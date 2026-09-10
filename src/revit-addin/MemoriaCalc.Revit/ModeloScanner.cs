using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Autodesk.Revit.DB;
using MemoriaCalc.Revit.Core;

namespace MemoriaCalc.Revit;

internal sealed class ScanOptions
{
    public bool IncluirVinculos { get; set; }
    public ICollection<ElementId>? SoloIds { get; set; }
}

internal static class ModeloScanner
{
    public static RevitPaquete Escanear(Document doc, string versionRevit, ScanOptions? opt = null)
    {
        opt ??= new ScanOptions();
        var piezas = new List<PiezaScan>();
        Recoger(doc, opt.SoloIds, "host", "", piezas);
        if (opt.IncluirVinculos && (opt.SoloIds == null || opt.SoloIds.Count == 0))
        {
            foreach (var link in new FilteredElementCollector(doc).OfClass(typeof(RevitLinkInstance)).Cast<RevitLinkInstance>())
            {
                var linkDoc = link.GetLinkDocument();
                if (linkDoc == null) continue;
                Recoger(linkDoc, null, "link", link.Name, piezas);
            }
        }

        var cache = LocalCache.Leer(doc);
        var vistos = new HashSet<string>(StringComparer.Ordinal);
        var cambios = new CambioResumen();
        foreach (var p in piezas)
        {
            vistos.Add(p.Sync.UniqueId);
            if (!cache.TryGetValue(p.Sync.UniqueId, out var oldHash))
            {
                p.Sync.Estado = "new";
                cambios.Nuevos++;
            }
            else if (oldHash != p.Sync.Hash)
            {
                p.Sync.Estado = "modified";
                cambios.Modificados++;
            }
            else
            {
                p.Sync.Estado = "unchanged";
                cambios.Iguales++;
            }
        }
        foreach (var old in cache.Keys)
        {
            if (vistos.Contains(old)) continue;
            cambios.Eliminados++;
            piezas.Add(new PiezaScan
            {
                Sync = new ElementoSync { UniqueId = old, Estado = "deleted", Categoria = "(eliminado)" },
                CamposWeb = new Dictionary<string, double>(),
                Rol = "desconocido",
            });
        }

        var paquete = new RevitPaquete
        {
            ModelId = ModelIdDe(doc),
            Revit =
            {
                Version = versionRevit,
                Archivo = string.IsNullOrWhiteSpace(doc.PathName) ? doc.Title : Path.GetFileName(doc.PathName),
                ModelId = ModelIdDe(doc),
            },
            Obra = { Nombre = NombreObra(doc) },
            Cambios = cambios,
            Elementos = piezas.Where(p => p.Sync.Estado != "deleted").Select(p => p.Sync).ToList(),
        };

        paquete.Resumen = paquete.Elementos
            .GroupBy(e => e.Categoria)
            .OrderByDescending(g => g.Count())
            .Select(g => new ResumenCategoria
            {
                Categoria = g.Key,
                N = g.Count(),
                Cantidades = Sumar(g.SelectMany(x => x.Cantidades)),
            })
            .ToList();

        paquete.Grupos = ArmarGrupos(piezas.Where(p => p.Sync.Estado != "deleted"));
        paquete.Eliminados = piezas.Where(p => p.Sync.Estado == "deleted").Select(p => p.Sync.UniqueId).ToList();
        return paquete;
    }

    private static void Recoger(Document doc, ICollection<ElementId>? solo, string origen, string link, List<PiezaScan> dest)
    {
        IEnumerable<Element> elems = new FilteredElementCollector(doc).WhereElementIsNotElementType();
        if (solo != null && solo.Count > 0) elems = elems.Where(e => solo.Contains(e.Id));
        foreach (var el in elems)
        {
            if (!CategoryDiscovery.EsModelo(el.Category)) continue;
            if (string.IsNullOrWhiteSpace(el.UniqueId)) continue;
            try
            {
                dest.Add(GenericExtractor.Extraer(doc, el, origen, link));
            }
            catch
            {
                /* un elemento defectuoso no tumba el análisis */
            }
        }
    }

    private static List<RevitGrupo> ArmarGrupos(IEnumerable<PiezaScan> piezas)
    {
        var list = new List<RevitGrupo>();
        var i = 1;
        foreach (var g in piezas.GroupBy(p => p.Rol + "|" + p.Sync.Categoria + "|" + p.Sync.Familia + "|" + p.Sync.Tipo + "|" + p.Sync.Nivel))
        {
            var first = g.First();
            var grupo = new RevitGrupo
            {
                GrupoId = $"G{i:000}",
                Rol = first.Rol,
                CategoriaRevit = first.Sync.Categoria,
                Familia = first.Sync.Familia,
                Tipo = first.Sync.Tipo,
                Material = first.Sync.Material,
                ClaseMaterial = first.Clase,
                Fc = first.Fc,
                Nivel = first.Sync.Nivel,
                ConfianzaClasificacion = Clasificador.Confianza(first.Rol, first.Sync.Categoria),
                Motivo = new List<string> { first.Sync.Categoria, first.Sync.Familia, first.Sync.Disciplina },
            };
            foreach (var p in g)
            {
                grupo.UniqueIds.Add(p.Sync.UniqueId);
                grupo.Elementos.Add(new RevitElemento
                {
                    UniqueId = p.Sync.UniqueId,
                    Marca = string.IsNullOrWhiteSpace(p.Sync.Marca) ? p.Sync.Tipo : p.Sync.Marca,
                    Tipo = p.Sync.Tipo,
                    Nivel = p.Sync.Nivel,
                    Cantidades = new Dictionary<string, double>(p.CamposWeb),
                });
                foreach (var kv in p.CamposWeb)
                    grupo.Cantidades[kv.Key] = Math.Round((grupo.Cantidades.TryGetValue(kv.Key, out var prev) ? prev : 0) + kv.Value, kv.Key == "acero_kg" ? 1 : 3);
            }
            grupo.NElementos = grupo.Elementos.Count;
            list.Add(grupo);
            i++;
        }
        return list;
    }

    private static List<CantidadValor> Sumar(IEnumerable<CantidadValor> items)
    {
        return items
            .GroupBy(c => c.Clave + "|" + c.Und)
            .Select(g => new CantidadValor
            {
                Clave = g.First().Clave,
                Und = g.First().Und,
                Valor = Math.Round(g.Sum(x => x.Valor), 3),
                Principal = g.Any(x => x.Principal),
            })
            .Where(c => c.Valor > 0)
            .ToList();
    }

    public static string ModelIdDe(Document doc) =>
        string.IsNullOrWhiteSpace(doc.PathName) ? doc.Title : Path.GetFileNameWithoutExtension(doc.PathName);

    private static string NombreObra(Document doc)
    {
        try
        {
            var n = doc.ProjectInformation is null ? null : doc.ProjectInformation.Name;
            if (!string.IsNullOrWhiteSpace(n) && !n.Equals("Project Information", StringComparison.OrdinalIgnoreCase))
                return n;
        }
        catch { /* nube */ }
        return Path.GetFileNameWithoutExtension(doc.Title);
    }
}
