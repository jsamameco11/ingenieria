# -*- coding: utf-8 -*-
"""Publica MemoriaCalc en control-ingenieria.miacademiapreu.com (y replica en ingenieria)."""
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
LOCAL_ENV = ROOT / "server" / ".env"
LOCAL_PHP = ROOT / "server" / "google-session.php"
APP_CTRL = "/var/www/control-ingenieria"
APP_ING = "/var/www/ingenieria"
OPT_ROOT = "/opt/memorcalc"
DOMAIN = "control-ingenieria.miacademiapreu.com"

VHOST = f"""<VirtualHost *:80>
    ServerName {DOMAIN}
    DocumentRoot {APP_CTRL}
    <Directory {APP_CTRL}>
        Options FollowSymLinks
        AllowOverride All
        Require all granted
        FallbackResource /index.html
    </Directory>
    IncludeOptional snippets/ingenieria-google-session.conf
    IncludeOptional snippets/ingenieria-culqi.conf
    IncludeOptional snippets/ingenieria-grok.conf
    IncludeOptional snippets/ingenieria-billing.conf
    IncludeOptional snippets/ingenieria-profile.conf
    ErrorLog ${{APACHE_LOG_DIR}}/control-ingenieria-error.log
    CustomLog ${{APACHE_LOG_DIR}}/control-ingenieria-access.log combined
</VirtualHost>
"""

BILLING_SNIPPET = """ProxyPreserveHost On
<Location /api/billing>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/billing
    ProxyPassReverse http://127.0.0.1:8788/api/billing
</Location>
<Location /api/control>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/control
    ProxyPassReverse http://127.0.0.1:8788/api/control
</Location>
<Location /api/profile>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/profile
    ProxyPassReverse http://127.0.0.1:8788/api/profile
</Location>
"""

HTACCESS = """RewriteEngine On
RewriteBase /
RewriteRule ^api/ - [L]
RewriteRule ^control\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
"""


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 180) -> str:
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
            parts = [p for p in parent.strip("/").split("/") if p]
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

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Conectando al VPS…")
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=25, allow_agent=False, look_for_keys=False)
    sftp = ssh.open_sftp()

    print("Subiendo dist →", APP_CTRL)
    run(ssh, f"mkdir -p {APP_CTRL} {APP_ING} {OPT_ROOT} {APP_CTRL}/assets {APP_ING}/assets")
    put_dir(sftp, LOCAL_DIST, APP_CTRL)
    print("Replicando en", APP_ING)
    run(ssh, f"rsync -a --delete --exclude addin {APP_CTRL}/ {APP_ING}/")
    print("Control arranca el panel, no la web de módulos")
    run(ssh, f"cp {APP_CTRL}/control.html {APP_CTRL}/index.html")

    print("Subiendo API")
    sftp.put(str(LOCAL_SERVER), f"{OPT_ROOT}/culqi-server.mjs")
    if LOCAL_PROMPT.exists():
        sftp.put(str(LOCAL_PROMPT), f"{OPT_ROOT}/prompt.mjs")
    if LOCAL_ENV.exists():
        sftp.put(str(LOCAL_ENV), "/etc/memorcalc-culqi.env")
        sftp.chmod("/etc/memorcalc-culqi.env", stat.S_IRUSR | stat.S_IWUSR)
    if LOCAL_PHP.exists():
        sftp.put(str(LOCAL_PHP), f"{OPT_ROOT}/google-session.php")

    print("Apache vhost + rewrite")
    run(ssh, "a2enmod proxy proxy_http headers rewrite >/dev/null 2>&1 || true")
    run(ssh, "mkdir -p /etc/apache2/snippets")
    run(ssh, f"cat > /etc/apache2/snippets/ingenieria-billing.conf <<'EOF'\n{BILLING_SNIPPET}EOF")
    run(ssh, f"cat > /etc/apache2/sites-available/{DOMAIN}.conf <<'EOF'\n{VHOST}EOF")
    run(ssh, f"cat > {APP_CTRL}/.htaccess <<'EOF'\n{HTACCESS}EOF")
    run(
        ssh,
        f"""cat > {APP_ING}/.htaccess <<'EOF'
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
    run(ssh, f"a2ensite {DOMAIN}.conf >/dev/null")
    run(ssh, "apache2ctl configtest")
    run(ssh, "systemctl reload apache2")

    print("Certificado TLS")
    cert = run(
        ssh,
        "certbot --apache -d "
        + DOMAIN
        + " --non-interactive --agree-tos --redirect --keep-until-expiring "
        + "-m miacademiapreu.pe@gmail.com || true",
        timeout=180,
    )
    print(cert[-800:] if len(cert) > 800 else cert)

    ssl = f"/etc/apache2/sites-enabled/{DOMAIN}-le-ssl.conf"
    http = f"/etc/apache2/sites-enabled/{DOMAIN}.conf"
    ing_ssl = "/etc/apache2/sites-enabled/ingenieria.miacademiapreu.com-le-ssl.conf"
    ing_http = "/etc/apache2/sites-enabled/ingenieria.miacademiapreu.com.conf"
    for vhost in (ssl, http, ing_ssl, ing_http):
        exists = run(ssh, f"test -f {vhost} && echo yes || true").strip()
        if not exists:
            continue
        run(
            ssh,
            f"grep -q 'ingenieria-billing.conf' {vhost} || "
            f"sed -i '/<\\/VirtualHost>/i\\    IncludeOptional snippets/ingenieria-billing.conf' {vhost}",
        )
    run(ssh, "apache2ctl configtest")
    run(ssh, "systemctl reload apache2")

    run(ssh, "systemctl restart memorcalc-culqi || true")
    print(run(ssh, f"ls -la {APP_CTRL} | head"))
    print(run(ssh, f"curl -sS -H 'Host: {DOMAIN}' http://127.0.0.1/ | head -c 240; echo"))

    sftp.close()
    ssh.close()
    print("DEPLOY_OK", f"https://{DOMAIN}")


if __name__ == "__main__":
    main()
