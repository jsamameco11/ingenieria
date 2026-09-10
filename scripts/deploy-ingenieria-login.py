# -*- coding: utf-8 -*-
"""Deploy MemoriaCalc login fix to ingenieria. Do not commit."""
from __future__ import annotations

import os
import stat
import sys
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8")

HOST = "161.132.51.100"
USER = "root"
PASSWORD = os.environ["VPS_PASS"]
ROOT = Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS")
LOCAL_DIST = ROOT / "dist"
LOCAL_SERVER = ROOT / "server" / "culqi-server.mjs"
LOCAL_PROMPT = ROOT / "server" / "prompt.mjs"
LOCAL_REVIT = ROOT / "server" / "revit-sync.mjs"
LOCAL_ENV = ROOT / "server" / ".env"
LOCAL_PHP = ROOT / "server" / "google-session.php"
APP_ROOT = "/var/www/ingenieria"
OPT_ROOT = "/opt/memorcalc"

GOOGLE_SNIPPET = """ProxyPreserveHost On
<Location /api/google-session>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/google-session
    ProxyPassReverse http://127.0.0.1:8788/api/google-session
</Location>
"""

GROK_SNIPPET = """ProxyPreserveHost On
ProxyTimeout 520
<Location /api/grok>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/grok
    ProxyPassReverse http://127.0.0.1:8788/api/grok
</Location>
"""

CULQI_SNIPPET = """ProxyPreserveHost On
<Location /api/charges>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/charges
    ProxyPassReverse http://127.0.0.1:8788/api/charges
</Location>
"""

BILLING_SNIPPET = """ProxyPreserveHost On
<Location /api/billing>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/billing
    ProxyPassReverse http://127.0.0.1:8788/api/billing
</Location>
"""

REVIT_SNIPPET = """ProxyPreserveHost On
<Location /api/v1>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/v1
    ProxyPassReverse http://127.0.0.1:8788/api/v1
</Location>
"""

PROFILE_SNIPPET = """ProxyPreserveHost On
<Location /api/profile>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/profile
    ProxyPassReverse http://127.0.0.1:8788/api/profile
</Location>
"""

DIR_SNIPPET = """<Directory /var/www/ingenieria>
    Options FollowSymLinks
    AllowOverride All
    Require all granted
    FallbackResource /index.html
</Directory>
"""


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> str:
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if code != 0:
        raise RuntimeError(f"CMD failed ({code}): {cmd}\n{out}\n{err}")
    return out


def put_dir(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    try:
        sftp.stat(remote)
    except FileNotFoundError:
        sftp.mkdir(remote)
    for path in local.rglob("*"):
        rel = path.relative_to(local).as_posix()
        target = f"{remote}/{rel}"
        if path.is_dir():
            try:
                sftp.stat(target)
            except FileNotFoundError:
                sftp.mkdir(target)
        else:
            parent = str(Path(target).parent).replace("\\", "/")
            try:
                sftp.stat(parent)
            except FileNotFoundError:
                # create parents
                parts = parent.strip("/").split("/")
                cur = ""
                for p in parts:
                    cur += "/" + p
                    try:
                        sftp.stat(cur)
                    except FileNotFoundError:
                        sftp.mkdir(cur)
            sftp.put(str(path), target)
            sftp.chmod(target, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)


def main() -> None:
    if not (LOCAL_DIST / "index.html").exists():
        raise SystemExit("Falta dist/index.html; ejecute npm run build primero.")
    if not LOCAL_SERVER.exists():
        raise SystemExit("Falta server/culqi-server.mjs")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Conectando al VPS…")
    ssh.connect(
        HOST,
        username=USER,
        password=PASSWORD,
        timeout=25,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = ssh.open_sftp()

    print("Subiendo dist →", APP_ROOT)
    run(ssh, f"mkdir -p {APP_ROOT} {OPT_ROOT} /var/www/control-ingenieria {APP_ROOT}/assets")
    put_dir(sftp, LOCAL_DIST, APP_ROOT)
    run(
        ssh,
        f"""cat > {APP_ROOT}/.htaccess <<'EOF'
<IfModule mod_headers.c>
  <FilesMatch "\\.(html)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
  </FilesMatch>
</IfModule>
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^api/ - [L]
  RewriteCond %{{REQUEST_FILENAME}} !-f
  RewriteCond %{{REQUEST_FILENAME}} !-d
  RewriteRule . /index.html [L]
</IfModule>
EOF""",
    )
    # Copia del panel /control si el vhost aparte sigue vivo
    run(ssh, "cp -a /var/www/ingenieria/. /var/www/control-ingenieria/ || true")
    run(ssh, "test -f /var/www/control-ingenieria/control.html && cp /var/www/control-ingenieria/control.html /var/www/control-ingenieria/index.html || true")

    print("Subiendo API Culqi + google-session proxy")
    sftp.put(str(LOCAL_SERVER), f"{OPT_ROOT}/culqi-server.mjs")
    if LOCAL_PROMPT.exists():
        sftp.put(str(LOCAL_PROMPT), f"{OPT_ROOT}/prompt.mjs")
    if LOCAL_REVIT.exists():
        sftp.put(str(LOCAL_REVIT), f"{OPT_ROOT}/revit-sync.mjs")
    if LOCAL_ENV.exists():
        sftp.put(str(LOCAL_ENV), "/etc/memorcalc-culqi.env")
        sftp.chmod("/etc/memorcalc-culqi.env", stat.S_IRUSR | stat.S_IWUSR)
    if LOCAL_PHP.exists():
        sftp.put(str(LOCAL_PHP), f"{OPT_ROOT}/google-session.php")

    print("Configurando Apache /api/* → :8788")
    run(ssh, "cat > /etc/apache2/snippets/ingenieria-google-session.conf <<'EOF'\n" + GOOGLE_SNIPPET + "EOF")
    run(ssh, "cat > /etc/apache2/snippets/ingenieria-culqi.conf <<'EOF'\n" + CULQI_SNIPPET + "EOF")
    run(ssh, "cat > /etc/apache2/snippets/ingenieria-billing.conf <<'EOF'\n" + BILLING_SNIPPET + "EOF")
    run(ssh, "cat > /etc/apache2/snippets/ingenieria-grok.conf <<'EOF'\n" + GROK_SNIPPET + "EOF")
    run(ssh, "cat > /etc/apache2/snippets/ingenieria-revit.conf <<'EOF'\n" + REVIT_SNIPPET + "EOF")
    run(ssh, "cat > /etc/apache2/snippets/ingenieria-profile.conf <<'EOF'\n" + PROFILE_SNIPPET + "EOF")
    run(ssh, "cat > /etc/apache2/snippets/ingenieria-spa.conf <<'EOF'\n" + DIR_SNIPPET + "EOF")
    ssl = "/etc/apache2/sites-enabled/ingenieria.miacademiapreu.com-le-ssl.conf"
    http = "/etc/apache2/sites-enabled/ingenieria.miacademiapreu.com.conf"
    for vhost in (ssl, http):
        exists = run(ssh, f"test -f {vhost} && echo yes || true").strip()
        if not exists:
            continue
        for snippet in (
            "ingenieria-google-session.conf",
            "ingenieria-culqi.conf",
            "ingenieria-billing.conf",
            "ingenieria-grok.conf",
            "ingenieria-revit.conf",
            "ingenieria-profile.conf",
            "ingenieria-spa.conf",
        ):
            run(
                ssh,
                f"grep -q '{snippet}' {vhost} || "
                f"sed -i '/<\\/VirtualHost>/i\\    IncludeOptional snippets/{snippet}' {vhost}",
            )
    run(ssh, "a2enmod proxy proxy_http headers rewrite >/dev/null 2>&1 || true")
    run(ssh, "apache2ctl configtest")
    run(ssh, "systemctl reload apache2")

    # systemd unit for culqi if missing
    unit = "/etc/systemd/system/memorcalc-culqi.service"
    run(
        ssh,
        f"""cat > {unit} <<'EOF'
[Unit]
Description=MemoriaCalc Culqi + Google session proxy
After=network.target

[Service]
Type=simple
WorkingDirectory={OPT_ROOT}
EnvironmentFile=/etc/memorcalc-culqi.env
ExecStart=/usr/bin/node {OPT_ROOT}/culqi-server.mjs
Restart=always
RestartSec=3
TimeoutSec=420
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF""",
    )
    run(ssh, "systemctl daemon-reload")
    run(ssh, "systemctl enable --now memorcalc-culqi")
    run(ssh, "systemctl restart memorcalc-culqi")
    run(ssh, "sleep 1; systemctl is-active memorcalc-culqi")

    print("Verificando endpoints locales en el VPS…")
    print(run(ssh, "curl -sS http://127.0.0.1:8788/api/charges/health || true"))
    print(
        run(
            ssh,
            "curl -sS -X POST http://127.0.0.1:8788/api/google-session "
            "-H 'Content-Type: application/json' -d '{\"id_token\":\"x\"}' || true",
        )
    )
    print(run(ssh, f"ls -la {APP_ROOT} | head; ls {APP_ROOT}/assets | head"))

    sftp.close()
    ssh.close()
    print("DEPLOY_OK")


if __name__ == "__main__":
    main()
