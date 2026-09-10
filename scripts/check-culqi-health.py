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
cmd = """
systemctl restart memorcalc-culqi
sleep 2
systemctl is-active memorcalc-culqi || true
journalctl -u memorcalc-culqi -n 50 --no-pager
echo '=== HEALTH ==='
curl -sS http://127.0.0.1:8788/api/health || true
echo
echo '=== CONTROL KEYS ==='
grep -E '^CONTROL_' /etc/memorcalc-culqi.env | cut -d= -f1 || true
"""
_, out, err = ssh.exec_command(cmd, timeout=60)
print(out.read().decode("utf-8", "replace"))
print(err.read().decode("utf-8", "replace"))
ssh.close()
