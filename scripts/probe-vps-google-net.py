# -*- coding: utf-8 -*-
import os
import paramiko

HOST = "161.132.51.100"
PASSWORD = os.environ["VPS_PASS"]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=PASSWORD, timeout=25, allow_agent=False, look_for_keys=False)

def run(cmd: str) -> str:
    _i, o, e = ssh.exec_command(cmd, timeout=60)
    return (o.read() + e.read()).decode("utf-8", "replace")

print("=== GOOGLE_CLIENT_IDS raw ===")
print(run("grep '^GOOGLE_CLIENT_IDS=' /etc/memorcalc-culqi.env"))
print("=== tokeninfo reachability ===")
print(run("curl -sS -o /tmp/ti.txt -w '%{http_code}' 'https://oauth2.googleapis.com/tokeninfo?id_token=x.y.z'; echo; head -c 200 /tmp/ti.txt; echo"))
print("=== folio license google works ===")
print(run("curl -sS -X POST https://folio-api.miacademiapreu.com/api/auth/google -H 'Content-Type: application/json' -d '{\"email\":\"jrenzosamco@gmail.com\",\"sub\":\"probe\",\"name\":\"probe\",\"install_id\":\"vps-probe\"}' | head -c 180; echo"))
ssh.close()
