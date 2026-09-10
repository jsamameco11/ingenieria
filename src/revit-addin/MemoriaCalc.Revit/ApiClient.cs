using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using MemoriaCalc.Revit.Core;

namespace MemoriaCalc.Revit;

internal sealed class DeviceState
{
    public string ApiBase { get; set; } = AddinInfo.DefaultApi;
    public string DeviceToken { get; set; } = "";
    public string Email { get; set; } = "";
    public string UserId { get; set; } = "";
}

internal static class ApiClient
{
    public static DeviceState State { get; private set; } = Cargar();

    public static bool Conectado => !string.IsNullOrWhiteSpace(State.DeviceToken);

    public static async Task<(bool ok, string msg)> Reclamar(string apiBase, string code)
    {
        ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
        var url = apiBase.TrimEnd('/') + "/api/v1/revit/pair/claim";
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(25) };
        var body = JsonSerializer.Serialize(new { code });
        var res = await http.PostAsync(url, new StringContent(body, Encoding.UTF8, "application/json")).ConfigureAwait(false);
        var raw = await res.Content.ReadAsStringAsync().ConfigureAwait(false);
        if (!res.IsSuccessStatusCode) return (false, Mensaje(raw, "No se pudo conectar. Revise el código y el Plan Pro."));
        using var doc = JsonDocument.Parse(raw);
        var r = doc.RootElement;
        State = new DeviceState
        {
            ApiBase = apiBase.TrimEnd('/'),
            DeviceToken = r.GetProperty("deviceToken").GetString() ?? "",
            Email = r.TryGetProperty("email", out var e) ? e.GetString() ?? "" : "",
            UserId = r.TryGetProperty("userId", out var u) ? u.GetString() ?? "" : "",
        };
        Guardar();
        return (true, "Conectado como " + (State.Email.Length > 0 ? State.Email : "Plan Pro"));
    }

    public static async Task<(bool ok, string msg)> Sincronizar(string jsonPaquete)
    {
        if (!Conectado) return (false, "Conéctese primero con el código de Vincular con Revit.");
        ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
        var url = State.ApiBase.TrimEnd('/') + "/api/v1/revit/sync";
        using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(3) };
        http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", "Bearer " + State.DeviceToken);
        var res = await http.PostAsync(url, new StringContent(jsonPaquete, Encoding.UTF8, "application/json")).ConfigureAwait(false);
        var raw = await res.Content.ReadAsStringAsync().ConfigureAwait(false);
        if (!res.IsSuccessStatusCode) return (false, Mensaje(raw, "La API no aceptó la sincronización."));
        return (true, "Sincronizado. Abra Vincular con Revit para ver los metrados.");
    }

    public static void Desconectar()
    {
        State = new DeviceState { ApiBase = State.ApiBase };
        Guardar();
    }

    private static DeviceState Cargar()
    {
        try
        {
            var p = LocalCache.DevicePath();
            if (!File.Exists(p)) return new DeviceState();
            return JsonSerializer.Deserialize<DeviceState>(File.ReadAllText(p)) ?? new DeviceState();
        }
        catch { return new DeviceState(); }
    }

    private static void Guardar()
    {
        try { File.WriteAllText(LocalCache.DevicePath(), JsonSerializer.Serialize(State)); }
        catch { /* perfil de usuario */ }
    }

    private static string Mensaje(string raw, string fallback)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("message", out var m)) return m.GetString() ?? fallback;
        }
        catch { /* html o vacío */ }
        return fallback;
    }
}
