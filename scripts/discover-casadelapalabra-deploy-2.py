# -*- coding: utf-8 -*-
"""Segunda ronda, solo lectura: confirma que /opt/casa-de-la-palabra-web y
-admin son clones de git del mismo repo, y cómo los arranca systemd, antes
de armar el script de despliegue real. No cambia nada.

Uso (PowerShell):
    $env:VPS_PASS = "tu-password"
    python scripts/discover-casadelapalabra-deploy-2.py
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
    "cat /etc/systemd/system/casa-de-la-palabra-web.service",
    "cat /etc/systemd/system/casa-de-la-palabra-admin.service",
    "cd /opt/casa-de-la-palabra-web && git remote -v && git branch --show-current && git log --oneline -5 && git status --porcelain",
    "cd /opt/casa-de-la-palabra-admin && git remote -v && git branch --show-current && git log --oneline -5 && git status --porcelain",
    "node --version && npm --version",
    "ls -la /opt/casa-de-la-palabra-web/.env.local 2>&1",
    "ls -la /opt/casa-de-la-palabra-admin/.env.local 2>&1",
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
