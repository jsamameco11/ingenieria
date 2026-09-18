# -*- coding: utf-8 -*-
"""Publica MemoriaCalc: detecta cambios, compila, sube al VPS y hace commit en GitHub.

Uso (siempre el mismo):
    python scripts/publicar.py
    npm run publicar
    .\\scripts\\publicar.ps1

Opcional:
    python scripts/publicar.py -m "Por qué cambia esto"
    python scripts/publicar.py --sin-vps
    python scripts/publicar.py --sin-git
    python scripts/publicar.py --solo-build
    python scripts/publicar.py --dry-run

No commitea dist, .env ni tmp-mae-verify (están en .gitignore).
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_URL = "https://ingenieria.miacademiapreu.com"
GITHUB = "https://github.com/jsamameco11/ingenieria.git"
REMOTE = "origin"
BRANCH_FALLBACK = "main"

AREAS: tuple[tuple[str, str], ...] = (
    ("src/lib/engines/influence/", "líneas de influencia"),
    ("src/lib/engines/maestria/", "losa/zapata/platea"),
    ("src/components/maestria/", "losa/zapata/platea"),
    ("src/modules/MaestriaEstructurasModule.tsx", "losa/zapata/platea"),
    ("src/lib/engines/tanques.ts", "tanques"),
    ("src/components/DiagramTanques.tsx", "tanques"),
    ("src/lib/engines/murosTierra.ts", "muros"),
    ("src/components/MuroDidactica.tsx", "muros"),
    ("src/lib/steel", "despiece de aceros"),
    ("src/components/SteelSectionFig.tsx", "despiece de aceros"),
    ("src/components/Diagram.tsx", "diagramas"),
    ("src/control/", "panel de control"),
    ("scripts/publicar.", "flujo de publicación"),
    ("scripts/deploy-", "despliegue VPS"),
    ("funcionalidades/", "catálogo de funcionalidades"),
    ("server/culqi-server.mjs", "pagos Culqi"),
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


class StepError(RuntimeError):
    pass


def npm_cmd() -> str:
    name = "npm.cmd" if os.name == "nt" else "npm"
    found = shutil.which(name) or shutil.which("npm")
    if not found:
        raise StepError("No se encontró npm en el PATH.")
    return found


def python_cmd() -> str:
    return sys.executable


def git_out(args: list[str], *, check: bool = True) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if check and proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise StepError(f"git {' '.join(args)} falló ({proc.returncode}).\n{err}")
    return (proc.stdout or "").strip()


def run(cmd: list[str], *, title: str, timeout: int = 600) -> str:
    print(f"\n→ {title}")
    print(" ", " ".join(cmd))
    proc = subprocess.run(
        cmd,
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    if proc.stdout.strip():
        print(proc.stdout.rstrip())
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise StepError(f"{title} falló ({proc.returncode}).\n{err}")
    if proc.stderr.strip() and "error" in proc.stderr.lower():
        print(proc.stderr.rstrip())
    return proc.stdout


def git(args: list[str], *, title: str | None = None, timeout: int = 120) -> str:
    return run(["git", *args], title=title or f"git {' '.join(args)}", timeout=timeout)


def current_branch() -> str:
    return git_out(["rev-parse", "--abbrev-ref", "HEAD"]) or BRANCH_FALLBACK


def porcelain_files() -> list[tuple[str, str]]:
    raw = git_out(["status", "--porcelain"], check=False)
    rows: list[tuple[str, str]] = []
    for line in raw.splitlines():
        if len(line) < 4:
            continue
        code = line[:2].strip() or line[:2]
        path = line[3:].strip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        rows.append((code, path))
    return rows


def git_has_index_changes() -> bool:
    cached = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT)
    work = subprocess.run(["git", "diff", "--quiet"], cwd=ROOT)
    untracked = git_out(["ls-files", "--others", "--exclude-standard"], check=False)
    return cached.returncode != 0 or work.returncode != 0 or bool(untracked)


def area_de(path: str) -> str:
    norm = path.replace("\\", "/")
    for prefix, label in AREAS:
        if norm.startswith(prefix) or prefix in norm:
            return label
    if norm.startswith("src/"):
        return "aplicación"
    if norm.startswith("scripts/"):
        return "scripts"
    return Path(norm).name


def mensaje_desde_cambios(files: list[str]) -> str:
    if not files:
        return "Publica MemoriaCalc en ingenieria.miacademiapreu.com y sincroniza GitHub."
    seen: list[str] = []
    for path in files:
        label = area_de(path)
        if label not in seen:
            seen.append(label)
    if len(seen) == 1:
        cuerpo = seen[0]
    elif len(seen) == 2:
        cuerpo = f"{seen[0]} y {seen[1]}"
    else:
        cuerpo = f"{', '.join(seen[:-1])} y {seen[-1]}"
    n = len(files)
    archivo = "archivo" if n == 1 else "archivos"
    return f"Publica {n} {archivo} ({cuerpo}) en producción y GitHub."


def snapshot_antes() -> dict:
    branch = current_branch()
    head = git_out(["rev-parse", "--short", "HEAD"])
    subject = git_out(["log", "-1", "--format=%s"])
    files = porcelain_files()
    stat = git_out(["diff", "--stat", "HEAD"], check=False)
    print("\nANTES  (último commit en GitHub / HEAD local)")
    print(f"  rama   {branch}")
    print(f"  HEAD   {head}  {subject}")
    if not files:
        print("  cambios  ninguno (working tree limpio)")
    else:
        print(f"  cambios  {len(files)} archivo(s) respecto de HEAD:")
        for code, path in files[:40]:
            print(f"    {code:2}  {path}")
        if len(files) > 40:
            print(f"    … +{len(files) - 40} más")
        if stat:
            print("  diff vs HEAD:")
            for line in stat.splitlines():
                print(f"    {line}")
    return {
        "branch": branch,
        "head": head,
        "subject": subject,
        "files": [p for _, p in files],
    }


def snapshot_despues(antes: dict) -> None:
    head = git_out(["rev-parse", "--short", "HEAD"])
    subject = git_out(["log", "-1", "--format=%s"])
    print("\nDESPUÉS")
    print(f"  HEAD   {head}  {subject}")
    if head != antes["head"]:
        print(f"  commit nuevo respecto de {antes['head']}")
        rango = git_out(["diff", "--stat", f"{antes['head']}..HEAD"], check=False)
        if rango:
            for line in rango.splitlines():
                print(f"    {line}")
    else:
        print("  mismo HEAD: no hubo commit nuevo")
    print(f"  VPS     {PUBLIC_URL}")
    print(f"  GitHub  {GITHUB}")
    print("  Ctrl+F5 en el navegador tras el deploy.")


def step_build() -> None:
    run([npm_cmd(), "run", "build"], title="Compilar (tsc + Vite)", timeout=300)
    index = ROOT / "dist" / "index.html"
    if not index.exists():
        raise StepError("El build terminó sin dist/index.html.")
    print("  dist/index.html listo.")


def step_vps() -> None:
    if not os.environ.get("VPS_PASS"):
        print("  Aviso: VPS_PASS no está en el entorno; se intentará con la llave SSH del agente.")
    run(
        [python_cmd(), str(ROOT / "scripts" / "deploy-control-ingenieria.py")],
        title=f"Publicar VPS → {PUBLIC_URL}",
        timeout=420,
    )


def step_github(message: str) -> None:
    git(["add", "-A"], title="GitHub: indexar cambios")
    if not git_has_index_changes():
        print("  Working tree limpio: no hay commit nuevo.")
    else:
        git(["commit", "-m", message], title="GitHub: commit")
    branch = current_branch()
    git(["push", "-u", REMOTE, branch], title=f"GitHub: push {REMOTE}/{branch}", timeout=180)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Detecta cambios, compila MemoriaCalc, publica en el VPS y hace commit en GitHub.",
    )
    p.add_argument(
        "-m",
        "--mensaje",
        default="",
        help="Mensaje del commit. Si se omite, se arma a partir de los archivos cambiados.",
    )
    p.add_argument("--solo-build", action="store_true", help="Solo npm run build.")
    p.add_argument("--sin-vps", action="store_true", help="No subir al servidor.")
    p.add_argument("--sin-git", action="store_true", help="No hacer commit ni push.")
    p.add_argument("--dry-run", action="store_true", help="Muestra el antes y el plan; no ejecuta.")
    return p.parse_args()


def main() -> int:
    os.chdir(ROOT)
    args = parse_args()
    do_vps = not args.solo_build and not args.sin_vps
    do_git = not args.solo_build and not args.sin_git

    print("MemoriaCalc · publicar")
    print(f"  raíz   {ROOT}")
    print(f"  sitio  {PUBLIC_URL}")
    print(f"  repo   {GITHUB}")
    print(f"  pasos  identificar + build{' + VPS' if do_vps else ''}{' + GitHub' if do_git else ''}")

    antes = snapshot_antes()
    mensaje = (args.mensaje or "").strip() or mensaje_desde_cambios(antes["files"])
    print(f"  commit {mensaje}")

    if args.dry_run:
        print("\n  (dry-run: no se compiló ni se subió nada)")
        return 0

    if args.solo_build:
        try:
            step_build()
        except StepError as exc:
            print(f"\nERROR: {exc}", file=sys.stderr)
            return 1
        print("\nListo (solo build).")
        return 0

    warnings: list[str] = []
    try:
        step_build()
        if do_vps:
            try:
                step_vps()
            except StepError as exc:
                warnings.append(str(exc))
                print(f"\nAVISO: el VPS no se publicó; se continúa con GitHub.\n{exc}", file=sys.stderr)
        if do_git:
            step_github(mensaje)
    except StepError as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1
    except subprocess.TimeoutExpired as exc:
        print(f"\nERROR: tiempo agotado en {exc.cmd}", file=sys.stderr)
        return 1

    snapshot_despues(antes)
    if warnings:
        print("  El commit en GitHub se hizo; revise el aviso del VPS.")
        return 1
    print("\nListo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
