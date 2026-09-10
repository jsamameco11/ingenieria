# -*- coding: utf-8 -*-
import os
import stat
import sys
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS")
OPT = "/opt/memorcalc"
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
sftp = ssh.open_sftp()
for name in ("culqi-server.mjs", "prompt.mjs", "revit-sync.mjs"):
    local = ROOT / "server" / name
    if not local.exists():
        raise SystemExit(f"Falta {local}")
    remote = f"{OPT}/{name}"
    print("put", name)
    sftp.put(str(local), remote)
    sftp.chmod(remote, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
sftp.close()
cmd = """
systemctl reset-failed memorcalc-culqi
systemctl restart memorcalc-culqi
sleep 2
systemctl is-active memorcalc-culqi
curl -sS http://127.0.0.1:8788/api/health
echo
curl -sS http://127.0.0.1:8788/api/billing/launch
echo
"""
_, out, err = ssh.exec_command(cmd, timeout=60)
print(out.read().decode("utf-8", "replace"))
print(err.read().decode("utf-8", "replace"))
ssh.close()
