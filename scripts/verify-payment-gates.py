# -*- coding: utf-8 -*-
import os
import sys

import paramiko

sys.stdout.reconfigure(encoding="utf-8")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(
    "161.132.51.100",
    username="root",
    password=os.environ["VPS_PASS"],
    timeout=25,
    allow_agent=False,
    look_for_keys=False,
)
cmd = r"""
echo '=== Grok sin auth ==='
curl -sS -o /tmp/g1.json -w '%{http_code}' -X POST http://127.0.0.1:8788/api/grok/leer-planos -H 'Content-Type: application/json' -d '{"pages":[{"dataUrl":"data:image/png;base64,aa"}]}'
echo
cat /tmp/g1.json; echo
echo '=== Grok auth fake sin charge ==='
curl -sS -o /tmp/g2.json -w '%{http_code}' -X POST http://127.0.0.1:8788/api/grok/leer-planos -H 'Content-Type: application/json' -H 'Authorization: Bearer fake' -d '{"pages":[{"dataUrl":"data:image/png;base64,aa"}]}'
echo
cat /tmp/g2.json; echo
echo '=== Charge Pro blocked ==='
curl -sS -o /tmp/c1.json -w '%{http_code}' -X POST http://127.0.0.1:8788/api/charges/confirm -H 'Content-Type: application/json' -d '{"plan_id":"mc-monthly","amount_cents":2000,"email":"a@b.com","token_id":"tkn_test12345"}'
echo
cat /tmp/c1.json; echo
"""
_, out, err = ssh.exec_command(cmd, timeout=30)
print(out.read().decode("utf-8", "replace"))
print(err.read().decode("utf-8", "replace"))
ssh.close()
