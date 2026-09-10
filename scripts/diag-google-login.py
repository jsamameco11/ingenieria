# -*- coding: utf-8 -*-
import json
import os
import paramiko

HOST = "161.132.51.100"
PASSWORD = os.environ["VPS_PASS"]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=PASSWORD, timeout=25, allow_agent=False, look_for_keys=False)

def run(cmd: str) -> str:
    _i, o, e = ssh.exec_command(cmd, timeout=90)
    return (o.read() + e.read()).decode("utf-8", "replace")

print("=== CORS folio-api ===")
print(run(
    "curl -sS -D - -o /tmp/out.json -X OPTIONS "
    "'https://folio-api.miacademiapreu.com/api/auth/google' "
    "-H 'Origin: https://ingenieria.miacademiapreu.com' "
    "-H 'Access-Control-Request-Method: POST' "
    "-H 'Access-Control-Request-Headers: content-type' | head -40; echo BODY; head -c 120 /tmp/out.json; echo"
))

print("=== license mint ===")
print(run(
    "curl -sS -X POST 'https://folio-api.miacademiapreu.com/api/auth/google' "
    "-H 'Content-Type: application/json' -H 'Origin: https://ingenieria.miacademiapreu.com' "
    "-d '{\"email\":\"jrenzosamco@gmail.com\",\"sub\":\"diag-sub\",\"name\":\"Jhony\",\"install_id\":\"diag-vps\",\"app\":\"memorcalc\"}' "
    "> /tmp/lic.json; python3 - <<'PY'\n"
    "import json\n"
    "d=json.load(open('/tmp/lic.json'))\n"
    "s=d.get('session') or {}\n"
    "print('ok', d.get('ok'), 'keys', sorted(s.keys())[:12])\n"
    "print('access', bool(s.get('access_token')), 'refresh', bool(s.get('refresh_token')), 'user', bool(s.get('user') or d.get('userId')))\n"
    "print('msg', d.get('message','')[:120])\n"
    "PY"
))

print("=== local api mint via license path (fake token) ===")
print(run(
    "curl -sS -X POST http://127.0.0.1:8788/api/google-session "
    "-H 'Content-Type: application/json' "
    "-d '{\"id_token\":\"a.b.c\",\"email\":\"jrenzosamco@gmail.com\",\"sub\":\"x\",\"name\":\"Jhony\",\"install_id\":\"x\",\"app\":\"memorcalc\"}'"
))

print("=== journal warn ===")
print(run("journalctl -u memorcalc-culqi -n 30 --no-pager | tail -30"))
ssh.close()
