# -*- coding: utf-8 -*-
import os
import sys

import paramiko

sys.stdout.reconfigure(encoding="utf-8")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "161.132.51.100",
    username="root",
    password=os.environ["VPS_PASS"],
    timeout=20,
    allow_agent=False,
    look_for_keys=False,
)
cmd = r"""
set -e
echo '=== INDEX ASSETS ==='
curl -sS -H 'Host: ingenieria.miacademiapreu.com' http://127.0.0.1/ | grep -oE 'assets/[^" ]+\.js' | head
JS=$(curl -sS -H 'Host: ingenieria.miacademiapreu.com' http://127.0.0.1/ | grep -oE 'assets/styles-[^"]+\.js' | head -1)
echo "styles=$JS"
echo '=== EDGE IN BUNDLE ==='
curl -sS -H "Host: ingenieria.miacademiapreu.com" "http://127.0.0.1/$JS" | grep -o 'functions/v1/google-session' | head -1 || echo MISSING
echo '=== PUBLIC GS ==='
curl -sS -X POST https://ingenieria.miacademiapreu.com/api/google-session -H 'Content-Type: application/json' -d '{"id_token":"bad"}'
echo
echo '=== PUBLIC HEALTH ==='
curl -sS https://ingenieria.miacademiapreu.com/api/charges/health
echo
echo '=== APACHE SNIPPET ==='
cat /etc/apache2/snippets/ingenieria-google-session.conf
grep -n google-session /etc/apache2/sites-enabled/ingenieria.miacademiapreu.com-le-ssl.conf || true
"""
_, out, err = c.exec_command(cmd, timeout=45)
print(out.read().decode("utf-8", "replace"))
e = err.read().decode("utf-8", "replace")
if e.strip():
    print("ERR", e)
c.close()
