# -*- coding: utf-8 -*-
"""Publica MemoriaCalc en ingenieria.miacademiapreu.com (sitio público) y el panel en control-ingenieria."""
from __future__ import annotations

import os
import stat
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8")

HOST = "161.132.51.100"
USER = "root"
PASSWORD = os.environ.get("VPS_PASS") or None
ROOT = Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS")
LOCAL_DIST = ROOT / "dist"
LOCAL_SERVER = ROOT / "server" / "culqi-server.mjs"
LOCAL_ECOSYSTEM = ROOT / "server" / "ecosystem.mjs"
LOCAL_PROMPT = ROOT / "server" / "prompt.mjs"
LOCAL_ENV = ROOT / "server" / ".env"
LOCAL_PHP = ROOT / "server" / "google-session.php"
APP_CTRL = "/var/www/control-ingenieria"
APP_ING = "/var/www/ingenieria"
OPT_ROOT = "/opt/memorcalc"
PUBLIC_DOMAIN = "ingenieria.miacademiapreu.com"
CTRL_DOMAIN = "control-ingenieria.miacademiapreu.com"

VHOST = f"""<VirtualHost *:80>
    ServerName {CTRL_DOMAIN}
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
    IncludeOptional snippets/ingenieria-control.conf
    IncludeOptional snippets/ingenieria-profile.conf
    IncludeOptional snippets/ingenieria-revit.conf
    ErrorLog ${{APACHE_LOG_DIR}}/control-ingenieria-error.log
    CustomLog ${{APACHE_LOG_DIR}}/control-ingenieria-access.log combined
</VirtualHost>
"""

GOOGLE_SNIPPET = """ProxyPreserveHost On
<Location /api/google-session>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/google-session
    ProxyPassReverse http://127.0.0.1:8788/api/google-session
</Location>
"""

CULQI_SNIPPET = """ProxyPreserveHost On
<Location /api/charges>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/charges
    ProxyPassReverse http://127.0.0.1:8788/api/charges
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

REVIT_SNIPPET = """ProxyPreserveHost On
<Location /api/v1>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/v1
    ProxyPassReverse http://127.0.0.1:8788/api/v1
</Location>
"""

BILLING_SNIPPET = """ProxyPreserveHost On
<Location /api/billing>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/billing
    ProxyPassReverse http://127.0.0.1:8788/api/billing
</Location>
"""

CONTROL_SNIPPET = """ProxyPreserveHost On
<Location /api/control>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/control
    ProxyPassReverse http://127.0.0.1:8788/api/control
</Location>
"""

PROFILE_SNIPPET = """ProxyPreserveHost On
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


def put_dist(ssh: paramiko.SSHClient, sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    fd, tmp = tempfile.mkstemp(suffix=".tgz")
    os.close(fd)
    try:
        with tarfile.open(tmp, "w:gz") as tar:
            for path in local.rglob("*"):
                if not path.is_file():
                    continue
                rel = path.relative_to(local).as_posix()
                if rel == "addin" or rel.startswith("addin/"):
                    continue
                tar.add(path, arcname=rel)
        remote_tar = "/tmp/memorcalc-dist.tgz"
        print("Empaquetado dist →", remote_tar)
        sftp.put(tmp, remote_tar)
        run(ssh, f"mkdir -p {remote} && tar -xzf {remote_tar} -C {remote} && rm -f {remote_tar}")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def main() -> None:
    if not (LOCAL_DIST / "index.html").exists():
        raise SystemExit("Falta dist/index.html; ejecute npm run build primero.")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Conectando al VPS…")
    if PASSWORD:
        ssh.connect(HOST, username=USER, password=PASSWORD, timeout=25, allow_agent=False, look_for_keys=False)
    else:
        ssh.connect(HOST, username=USER, timeout=25, allow_agent=True, look_for_keys=True)
    sftp = ssh.open_sftp()

    print("Subiendo dist →", APP_ING, "(", PUBLIC_DOMAIN, ")")
    run(ssh, f"mkdir -p {APP_CTRL} {APP_ING} {OPT_ROOT} {APP_CTRL}/assets {APP_ING}/assets")
    put_dist(ssh, sftp, LOCAL_DIST, APP_ING)
    print("Replicando archivos al panel", APP_CTRL)
    run(ssh, f"rsync -a --delete --exclude addin --exclude index.html {APP_ING}/ {APP_CTRL}/")
    print("Control arranca el panel, no la web de módulos")
    run(ssh, f"test -f {APP_CTRL}/control.html && cp {APP_CTRL}/control.html {APP_CTRL}/index.html")

    print("Subiendo API")
    sftp.put(str(LOCAL_SERVER), f"{OPT_ROOT}/culqi-server.mjs")
    if LOCAL_ECOSYSTEM.exists():
        sftp.put(str(LOCAL_ECOSYSTEM), f"{OPT_ROOT}/ecosystem.mjs")
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
    run(ssh, f"cat > /etc/apache2/snippets/ingenieria-google-session.conf <<'EOF'\n{GOOGLE_SNIPPET}EOF")
    run(ssh, f"cat > /etc/apache2/snippets/ingenieria-culqi.conf <<'EOF'\n{CULQI_SNIPPET}EOF")
    run(ssh, f"cat > /etc/apache2/snippets/ingenieria-grok.conf <<'EOF'\n{GROK_SNIPPET}EOF")
    run(ssh, f"cat > /etc/apache2/snippets/ingenieria-revit.conf <<'EOF'\n{REVIT_SNIPPET}EOF")
    run(ssh, f"cat > /etc/apache2/snippets/ingenieria-billing.conf <<'EOF'\n{BILLING_SNIPPET}EOF")
    run(ssh, f"cat > /etc/apache2/snippets/ingenieria-control.conf <<'EOF'\n{CONTROL_SNIPPET}EOF")
    run(ssh, f"cat > /etc/apache2/snippets/ingenieria-profile.conf <<'EOF'\n{PROFILE_SNIPPET}EOF")
    ctrl_avail = f"/etc/apache2/sites-available/{CTRL_DOMAIN}.conf"
    has_ctrl = run(ssh, f"test -f {ctrl_avail} && echo yes || true").strip()
    if not has_ctrl:
        run(ssh, f"cat > {ctrl_avail} <<'EOF'\n{VHOST}EOF")
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
    run(ssh, f"a2ensite {CTRL_DOMAIN}.conf >/dev/null 2>&1 || true")
    run(ssh, "apache2ctl configtest")
    run(ssh, "systemctl reload apache2")

    print("Certificado TLS")
    cert = run(
        ssh,
        "certbot --apache -d "
        + PUBLIC_DOMAIN
        + " --non-interactive --agree-tos --redirect --keep-until-expiring "
        + "-m miacademiapreu.pe@gmail.com || true",
        timeout=180,
    )
    print(cert[-800:] if len(cert) > 800 else cert)

    ssl = f"/etc/apache2/sites-enabled/{CTRL_DOMAIN}-le-ssl.conf"
    http = f"/etc/apache2/sites-enabled/{CTRL_DOMAIN}.conf"
    ing_ssl = f"/etc/apache2/sites-enabled/{PUBLIC_DOMAIN}-le-ssl.conf"
    ing_http = f"/etc/apache2/sites-enabled/{PUBLIC_DOMAIN}.conf"
    snippets = (
        "ingenieria-google-session.conf",
        "ingenieria-culqi.conf",
        "ingenieria-grok.conf",
        "ingenieria-revit.conf",
        "ingenieria-billing.conf",
        "ingenieria-control.conf",
        "ingenieria-profile.conf",
    )
    for vhost in (ssl, http, ing_ssl, ing_http):
        exists = run(ssh, f"test -f {vhost} && echo yes || true").strip()
        if not exists:
            continue
        for snippet in snippets:
            run(
                ssh,
                f"grep -q '{snippet}' {vhost} || "
                f"sed -i '/<\\/VirtualHost>/i\\    IncludeOptional snippets/{snippet}' {vhost}",
            )
    run(ssh, "apache2ctl configtest")
    run(ssh, "systemctl reload apache2")

    run(ssh, "systemctl restart memorcalc-culqi || true")
    print(run(ssh, f"ls -la {APP_ING} | head"))
    print(run(ssh, f"curl -sS -H 'Host: {PUBLIC_DOMAIN}' http://127.0.0.1/ | head -c 280; echo"))
    print(run(ssh, f"grep -oE 'assets/main-[^\"]+\\.js' {APP_ING}/index.html; echo"))

    sftp.close()
    ssh.close()
    print("DEPLOY_OK", f"https://{PUBLIC_DOMAIN}")


if __name__ == "__main__":
    main()
