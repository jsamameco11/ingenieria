# -*- coding: utf-8 -*-
"""Restablece el proxy Apache /api/control → :8788 sin republicar el sitio."""
from __future__ import annotations

import os
import sys

import paramiko

sys.stdout.reconfigure(encoding="utf-8")

HOST = "161.132.51.100"
USER = "root"
PASSWORD = os.environ.get("VPS_PASS") or None

CONTROL_SNIPPET = """ProxyPreserveHost On
<Location /api/control>
    FallbackResource disabled
    ProxyPass http://127.0.0.1:8788/api/control
    ProxyPassReverse http://127.0.0.1:8788/api/control
</Location>
"""

VHOSTS = (
    "/etc/apache2/sites-enabled/control-ingenieria.miacademiapreu.com-le-ssl.conf",
    "/etc/apache2/sites-enabled/control-ingenieria.miacademiapreu.com.conf",
    "/etc/apache2/sites-enabled/ingenieria.miacademiapreu.com-le-ssl.conf",
    "/etc/apache2/sites-enabled/ingenieria.miacademiapreu.com.conf",
)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 60) -> str:
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if code != 0:
        raise RuntimeError(f"CMD failed ({code}): {cmd}\n{out}\n{err}")
    return out


def main() -> None:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Conectando al VPS…")
    if PASSWORD:
        ssh.connect(HOST, username=USER, password=PASSWORD, timeout=25, allow_agent=False, look_for_keys=False)
    else:
        ssh.connect(HOST, username=USER, timeout=25, allow_agent=True, look_for_keys=True)

    run(ssh, "a2enmod proxy proxy_http headers rewrite >/dev/null 2>&1 || true")
    run(ssh, "mkdir -p /etc/apache2/snippets")
    run(ssh, "cat > /etc/apache2/snippets/ingenieria-control.conf <<'EOF'\n" + CONTROL_SNIPPET + "EOF")
    for vhost in VHOSTS:
        exists = run(ssh, f"test -f {vhost} && echo yes || true").strip()
        if not exists:
            print("Sin vhost", vhost)
            continue
        run(
            ssh,
            f"grep -q 'ingenieria-control.conf' {vhost} || "
            f"sed -i '/<\\/VirtualHost>/i\\    IncludeOptional snippets/ingenieria-control.conf' {vhost}",
        )
        print("Include listo:", vhost)

    print(run(ssh, "apache2ctl configtest"))
    run(ssh, "systemctl reload apache2")
    run(ssh, "systemctl is-active memorcalc-culqi || systemctl restart memorcalc-culqi")
    print("Node :8788", run(ssh, "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8788/api/control/health || true"))
    print(
        "Apache Host control",
        run(
            ssh,
            "curl -sS -o /dev/null -w '%{http_code} %{content_type}' "
            "-H 'Host: control-ingenieria.miacademiapreu.com' "
            "http://127.0.0.1/api/control/health || true",
        ),
    )
    ssh.close()
    print("PROXY_OK")


if __name__ == "__main__":
    main()
