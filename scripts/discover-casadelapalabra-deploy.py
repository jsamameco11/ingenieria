# -*- coding: utf-8 -*-
"""Solo-lectura: averigua cómo está desplegado (o no) casadelapalabra en el
VPS, sin cambiar nada. Correr tú mismo, con VPS_PASS en el entorno.

Uso (PowerShell):
    $env:VPS_PASS = "tu-password"
    python scripts/discover-casadelapalabra-deploy.py
"""
from __future__ import annotations

import os
import sys

import paramiko

sys.stdout.reconfigure(encoding="utf-8")

HOST = "161.132.51.100"
USER = "root"
PASSWORD = os.environ["VPS_PASS"]

COMMANDS = [
    "ls -la /var/www/ 2>&1",
    "ls -la /opt/ 2>&1",
    "grep -rl 'casadelapalabra' /etc/nginx/sites-enabled/ 2>&1",
    "for f in $(grep -rl 'casadelapalabra' /etc/nginx/sites-enabled/ 2>/dev/null); do echo \"--- $f ---\"; cat \"$f\"; done",
    "pm2 list 2>&1",
    "systemctl list-units --type=service --all 2>&1 | grep -i casa",
    "find / -maxdepth 4 -iname '*casadelapalabra*' -o -iname '*casa-de-la-palabra*' 2>/dev/null",
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

for cmd in COMMANDS:
    print(f"\n$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    print(out.strip() or "(sin salida)")
    if err.strip():
        print("STDERR:", err.strip())

client.close()
