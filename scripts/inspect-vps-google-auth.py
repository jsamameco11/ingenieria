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

print("=== service ===")
print(run("systemctl is-active memorcalc-culqi; systemctl show memorcalc-culqi -p ActiveEnterTimestamp --value"))
print("=== grep allowlist ===")
print(run("grep -n 'GOOGLE_PROJECT_PREFIX\\|jnn9ibrh\\|No se pudo validar\\|googleClientAllowed' /opt/memorcalc/culqi-server.mjs | head -40"))
print("=== recent logs ===")
print(run("journalctl -u memorcalc-culqi -n 40 --no-pager"))
print("=== env keys ===")
print(run("grep -E '^(SUPABASE_|GOOGLE_)' /etc/memorcalc-culqi.env | sed 's/=.*/=***/'"))
ssh.close()
