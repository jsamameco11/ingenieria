# -*- coding: utf-8 -*-
"""Publica MemoriaCalc: compila, sube a ingenieria.miacademiapreu.com y empuja a GitHub.

Uso:
    python scripts/publicar.py -m "Por qué cambia esto"
    python scripts/publicar.py --sin-vps -m "Solo GitHub"
    python scripts/publicar.py --sin-git
    python scripts/publicar.py --solo-build

Requiere VPS_PASS en el entorno cuando se publica el VPS.
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
REMOTE = "origin"
BRANCH_FALLBACK = "main"

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


def git_has_index_changes() -> bool:
    """True si hay algo que commitear (staged, unstaged o untracked)."""
    cached = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT)
    work = subprocess.run(["git", "diff", "--quiet"], cwd=ROOT)
    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return cached.returncode != 0 or work.returncode != 0 or bool(untracked.stdout.strip())


def current_branch() -> str:
    out = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return out.stdout.strip() or BRANCH_FALLBACK


def step_github(message: str) -> None:
    git(["add", "-A"], title="Git: indexar cambios")
    if not git_has_index_changes():
        print("  Working tree limpio: no hay commit nuevo.")
    else:
        git(["commit", "-m", message], title="Git: commit")
    branch = current_branch()
    git(["push", "-u", REMOTE, branch], title=f"GitHub: push {REMOTE}/{branch}", timeout=180)
    log = git(["log", "-1", "--format=%h %s"], title="Git: último commit")
    print(f"  Rama {branch} en {REMOTE}.")
    print(f"  {log.strip()}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Compila MemoriaCalc, publica en ingenieria.miacademiapreu.com y sube a GitHub.",
    )
    p.add_argument(
        "-m",
        "--mensaje",
        default="",
        help="Mensaje del commit (el porqué). Si se omite, se usa un mensaje de publicación.",
    )
    p.add_argument("--solo-build", action="store_true", help="Solo npm run build.")
    p.add_argument("--sin-vps", action="store_true", help="No subir al servidor.")
    p.add_argument("--sin-git", action="store_true", help="No hacer commit ni push.")
    p.add_argument("--dry-run", action="store_true", help="Muestra el plan y sale.")
    return p.parse_args()


def main() -> int:
    os.chdir(ROOT)
    args = parse_args()
    do_vps = not args.solo_build and not args.sin_vps
    do_git = not args.solo_build and not args.sin_git
    mensaje = (args.mensaje or "").strip() or (
        "Publica MemoriaCalc en ingenieria.miacademiapreu.com y sincroniza GitHub."
    )

    print("MemoriaCalc · publicar")
    print(f"  raíz   {ROOT}")
    print(f"  sitio  {PUBLIC_URL}")
    print(f"  repo   https://github.com/jsamameco11/ingenieria.git")
    print(f"  pasos  build{' + VPS' if do_vps else ''}{' + GitHub' if do_git else ''}")
    if args.dry_run:
        print("  (dry-run: no se ejecutó nada)")
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

    print("\nListo.")
    print(f"  Sitio  {PUBLIC_URL}")
    print("  Ctrl+F5 en el navegador tras el deploy.")
    if warnings:
        print("  El commit en GitHub se hizo; revise el aviso del VPS.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
