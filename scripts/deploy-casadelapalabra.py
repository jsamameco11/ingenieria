# -*- coding: utf-8 -*-
"""Despliega casa-de-la-palabra-web y casa-de-la-palabra-admin al VPS.

Sigue el mismo patrón ya usado para las otras apps (backup a /root/backups,
subida de un tarball, reconstrucción, reinicio del servicio systemd) — nada
nuevo se inventa acá. NO toca .env.local ni .env.production en el servidor:
el tar no los incluye y la extracción solo agrega/sobreescribe archivos de
código, nunca borra lo que ya está.

Uso (PowerShell):
    $env:VPS_PASS = "tu-password"
    python scripts/deploy-casadelapalabra.py
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8")

HOST = "161.132.51.100"
USER = "root"
PASSWORD = os.environ["VPS_PASS"]

ROOT = Path(__file__).parent / "deploy-artifacts"
WEB_TAR = ROOT / "casa-web-deploy.tar.gz"
ADMIN_TAR = ROOT / "casa-admin-deploy.tar.gz"

APPS = [
    {
        "name": "web",
        "local_tar": WEB_TAR,
        "remote_dir": "/opt/casa-de-la-palabra-web",
        "service": "casa-de-la-palabra-web",
        "port": 8794,
    },
    {
        "name": "admin",
        "local_tar": ADMIN_TAR,
        "remote_dir": "/opt/casa-de-la-palabra-admin",
        "service": "casa-de-la-palabra-admin",
        "port": 8795,
    },
]

TIMESTAMP = time.strftime("%Y%m%d-%H%M%S")


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 300) -> tuple[int, str, str]:
    """Corre un comando remoto imprimiendo su salida en vivo, línea por línea,
    en vez de quedarse callado hasta que termina — así un paso largo (npm
    install, npm run build) nunca parece trabado."""
    print(f"\n$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    channel = stdout.channel
    channel.settimeout(timeout)
    out_chunks: list[str] = []
    err_chunks: list[str] = []

    while True:
        made_progress = False
        if channel.recv_ready():
            chunk = channel.recv(4096).decode(errors="replace")
            if chunk:
                print(chunk, end="", flush=True)
                out_chunks.append(chunk)
                made_progress = True
        if channel.recv_stderr_ready():
            chunk = channel.recv_stderr(4096).decode(errors="replace")
            if chunk:
                print(chunk, end="", flush=True)
                err_chunks.append(chunk)
                made_progress = True
        if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
            break
        if not made_progress:
            time.sleep(0.2)

    code = channel.recv_exit_status()
    out = "".join(out_chunks)
    err = "".join(err_chunks)
    if not out.endswith("\n"):
        print()
    return code, out, err


def main() -> None:
    if not WEB_TAR.exists() or not ADMIN_TAR.exists():
        raise SystemExit(f"Faltan los tarballs en {ROOT} — corre primero la creación local del paquete.")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    sftp = client.open_sftp()

    for app in APPS:
        print(f"\n===== {app['name']} =====")

        # 1) Backup, igual que el patrón ya usado para las otras apps — pero
        #    sin node_modules/.next: eso es lo que hacía que pareciera
        #    trabado (tar sin salida hasta terminar, sobre cientos de MB).
        backup_path = f"/root/backups/{Path(app['remote_dir']).name}-{TIMESTAMP}.tar.gz"
        run(
            client,
            f"mkdir -p /root/backups && "
            f"tar --exclude=node_modules --exclude=.next -czf {backup_path} -C {app['remote_dir']} . && "
            f"du -h {backup_path}",
            timeout=120,
        )

        # 2) Sube el tarball local.
        remote_tar = f"/tmp/{app['local_tar'].name}"
        print(f"\nSubiendo {app['local_tar']} -> {remote_tar}")
        sftp.put(str(app["local_tar"]), remote_tar)

        # 3) Extrae sobre el directorio existente. tar no borra lo que no
        #    está en el archivo (así que .env.local/.env.production quedan
        #    intactos), solo agrega/sobreescribe archivos de código.
        run(client, f"tar -xzf {remote_tar} -C {app['remote_dir']}")
        run(client, f"rm -f {remote_tar}")

        # 4) Instala dependencias (por si acaso) y reconstruye.
        code, _, _ = run(client, f"cd {app['remote_dir']} && npm install", timeout=600)
        if code != 0:
            print(f"npm install falló para {app['name']} — deteniendo antes de tocar el servicio.")
            continue

        code, _, _ = run(client, f"cd {app['remote_dir']} && npm run build", timeout=600)
        if code != 0:
            print(f"npm run build falló para {app['name']} — el servicio actual sigue corriendo la versión previa, no se reinicia.")
            continue

        # 5) Reinicia el servicio y confirma que vuelva a responder.
        run(client, f"systemctl restart {app['service']}")
        time.sleep(3)
        run(client, f"systemctl is-active {app['service']}")
        run(client, f"curl -s -o /dev/null -w 'HTTP %{{http_code}}\\n' http://127.0.0.1:{app['port']}/")

    sftp.close()
    client.close()
    print("\nListo.")


if __name__ == "__main__":
    main()
