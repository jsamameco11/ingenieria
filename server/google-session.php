<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit;
}

$envPath = "/etc/ingenieria-google-session.env";
$env = load_env($envPath);
$url = rtrim((string) ($env["SUPABASE_URL"] ?? ""), "/");
$service = (string) ($env["SUPABASE_SECRET_KEY"] ?? "");
$anon = (string) ($env["SUPABASE_PUBLISHABLE_KEY"] ?? "");
$allowed = array_values(array_filter(array_map("trim", preg_split("/[\s,]+/", (string) ($env["GOOGLE_CLIENT_IDS"] ?? "")) ?: [])));
if (!$allowed) {
    $allowed = [
        "554728885093-5f9q8een65smi1bfg5hnchvl433v1c4t.apps.googleusercontent.com",
        "554728885093-2hovflq9cs9cdk30o1s5i3tk437pmg2l.apps.googleusercontent.com",
        "554728885093-jnn9ibrh5jl7f5nfth67cabipo4i4bd6.apps.googleusercontent.com",
    ];
}

if ($url === "" || $service === "" || $anon === "" || !$allowed) {
    http_response_code(500);
    echo json_encode(["message" => "Falta configuración de Auth."]);
    exit;
}

$raw = file_get_contents("php://input") ?: "";
$body = json_decode($raw, true);
if (!is_array($body)) {
    $body = [];
}

$idToken = (string) ($body["id_token"] ?? "");
$verified = google_claims($idToken, $allowed);
if ($verified["ok"] === false) {
    http_response_code(401);
    echo json_encode(["message" => $verified["message"]]);
    exit;
}
$claims = $verified["claims"];
$email = strtolower(trim((string) ($claims["email"] ?? "")));
$name = (string) ($body["name"] ?? $claims["name"] ?? $email);
$sub = (string) ($claims["sub"] ?? "");

$password = bin2hex(random_bytes(16)) . "Aa1!";
$userId = find_user_id($url, $service, $email);

if ($userId === null) {
    $created = supabase_json("POST", $url . "/auth/v1/admin/users", $service, [
        "email" => $email,
        "password" => $password,
        "email_confirm" => true,
        "user_metadata" => [
            "full_name" => $name,
            "name" => $name,
            "avatar_url" => (string) ($claims["picture"] ?? ""),
            "google_sub" => $sub,
        ],
        "app_metadata" => [
            "provider" => "google",
            "providers" => ["google"],
            "google_sub" => $sub,
            "role" => "customer",
            "plan" => "free",
        ],
    ]);
    $userId = is_string($created["id"] ?? null) ? $created["id"] : find_user_id($url, $service, $email);
} else {
    supabase_json("PUT", $url . "/auth/v1/admin/users/" . rawurlencode($userId), $service, [
        "password" => $password,
        "email_confirm" => true,
        "user_metadata" => [
            "full_name" => $name,
            "name" => $name,
            "avatar_url" => (string) ($claims["picture"] ?? ""),
            "google_sub" => $sub,
        ],
    ]);
}

if (!$userId) {
    http_response_code(500);
    echo json_encode(["message" => "No se pudo crear la cuenta Folio."]);
    exit;
}

supabase_json("POST", $url . "/rest/v1/profiles", $service, [
    "id" => $userId,
    "email" => $email,
    "role" => "customer",
    "plan" => "free",
    "plan_id" => "free",
    "status" => "active",
    "device_limit" => 1,
], ["Prefer: resolution=merge-duplicates,return=minimal"], false);

$signed = supabase_json("POST", $url . "/auth/v1/token?grant_type=password", $anon, [
    "email" => $email,
    "password" => $password,
]);

supabase_json("PUT", $url . "/auth/v1/admin/users/" . rawurlencode($userId), $service, [
    "password" => bin2hex(random_bytes(16)) . "Aa1!",
], [], false);

$session = $signed["access_token"] ?? null;
$refresh = $signed["refresh_token"] ?? null;
if (!is_string($session) || $session === "" || !is_string($refresh) || $refresh === "") {
    http_response_code(400);
    $msg = (string) ($signed["error_description"] ?? $signed["msg"] ?? $signed["message"] ?? "Folio no pudo abrir la sesión.");
    if ($msg === "" || $msg === "Auth session missing!") {
        $msg = "Folio no pudo abrir la sesión. Verifique SUPABASE_PUBLISHABLE_KEY en el servidor.";
    }
    echo json_encode(["message" => $msg, "http" => $signed["_http"] ?? null]);
    exit;
}

$installId = (string) ($body["install_id"] ?? "");
if ($installId !== "") {
    supabase_json("POST", $url . "/rest/v1/installs", $service, [
        "install_id" => $installId,
        "user_id" => $userId,
        "email" => $email,
        "last_seen_at" => gmdate("c"),
        "app" => (string) ($body["app"] ?? "memorcalc"),
    ], ["Prefer: resolution=merge-duplicates,return=minimal"], false);
}

echo json_encode([
    "ok" => true,
    "session" => [
        "access_token" => $session,
        "refresh_token" => $refresh,
        "expires_in" => $signed["expires_in"] ?? null,
        "token_type" => $signed["token_type"] ?? "bearer",
        "user" => $signed["user"] ?? ["id" => $userId, "email" => $email],
    ],
    "user" => $signed["user"] ?? ["id" => $userId, "email" => $email],
    "userId" => $userId,
    "email" => $email,
]);

function load_env(string $path): array
{
    $out = [];
    if (!is_readable($path)) {
        return $out;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === "" || str_starts_with($line, "#") || !str_contains($line, "=")) {
            continue;
        }
        [$k, $v] = explode("=", $line, 2);
        $out[trim($k)] = trim($v);
    }
    return $out;
}

function google_claims(string $idToken, array $allowed): array
{
    if ($idToken === "" || count(explode(".", $idToken)) !== 3) {
        return ["ok" => false, "message" => "Google no entregó un identificador válido."];
    }
    $res = http_get("https://oauth2.googleapis.com/tokeninfo?id_token=" . rawurlencode($idToken));
    $claims = is_array($res) ? $res : [];
    if (($claims["_http"] ?? 500) >= 400) {
        return ["ok" => false, "message" => "Google no reconoció el acceso. Vuelva a entrar."];
    }
    $iss = (string) ($claims["iss"] ?? "");
    if ($iss !== "https://accounts.google.com" && $iss !== "accounts.google.com") {
        return ["ok" => false, "message" => "El token no proviene de Google."];
    }
    $exp = (int) ($claims["exp"] ?? 0);
    if ($exp <= 0 || ($exp * 1000) < (int) (microtime(true) * 1000) - 60_000) {
        return ["ok" => false, "message" => "La sesión de Google caducó. Vuelva a entrar."];
    }
    if (empty($claims["email"]) || empty($claims["sub"])) {
        return ["ok" => false, "message" => "Google no compartió el correo de la cuenta."];
    }
    if ((string) ($claims["email_verified"] ?? "") === "false") {
        return ["ok" => false, "message" => "Ese correo de Google no está verificado."];
    }
    $aud = (string) ($claims["aud"] ?? "");
    $azp = (string) ($claims["azp"] ?? "");
    if (!google_client_allowed($aud, $allowed) && !google_client_allowed($azp, $allowed)) {
        return ["ok" => false, "message" => "No se pudo validar el acceso con Google. Use «Elegir otra cuenta» e inténtelo de nuevo."];
    }
    return ["ok" => true, "claims" => $claims];
}

function google_client_allowed(string $id, array $allowed): bool
{
    $value = trim($id);
    if ($value === "") {
        return false;
    }
    if (in_array($value, $allowed, true)) {
        return true;
    }
    return str_starts_with($value, "554728885093-") && str_ends_with($value, ".apps.googleusercontent.com");
}

function find_user_id(string $url, string $service, string $email): ?string
{
    $endpoints = [
        $url . "/auth/v1/admin/users?email=" . rawurlencode($email),
        $url . "/auth/v1/admin/users?filter=" . rawurlencode($email),
    ];
    foreach ($endpoints as $endpoint) {
        $data = supabase_json("GET", $endpoint, $service, null, [], false);
        $rows = [];
        if (isset($data["users"]) && is_array($data["users"])) {
            $rows = $data["users"];
        } elseif (isset($data["user"]) && is_array($data["user"])) {
            $rows = [$data["user"]];
        }
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            if (strtolower((string) ($row["email"] ?? "")) === $email && !empty($row["id"])) {
                return (string) $row["id"];
            }
        }
    }
    for ($page = 1; $page <= 8; $page++) {
        $listed = supabase_json("GET", $url . "/auth/v1/admin/users?page=" . $page . "&per_page=200", $service, null, [], false);
        $users = is_array($listed["users"] ?? null) ? $listed["users"] : [];
        foreach ($users as $row) {
            if (!is_array($row)) {
                continue;
            }
            if (strtolower((string) ($row["email"] ?? "")) === $email && !empty($row["id"])) {
                return (string) $row["id"];
            }
        }
        if (count($users) < 200) {
            break;
        }
    }
    return null;
}

function supabase_json(string $method, string $url, string $key, mixed $payload = null, array $extra = [], bool $throwHttp = true): array
{
    $headers = array_merge([
        "apikey: " . $key,
        "Authorization: Bearer " . $key,
        "Content-Type: application/json",
    ], $extra);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode(is_string($raw) ? $raw : "", true);
    if (!is_array($data)) {
        $data = [];
    }
    $data["_http"] = $code;
    if ($throwHttp && $code >= 400) {
        return $data;
    }
    return $data;
}

function http_get(string $url): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode(is_string($raw) ? $raw : "", true);
    if (!is_array($data)) {
        $data = [];
    }
    $data["_http"] = $code;
    return $data;
}
