# MemoriaCalc

Plataforma de memorias de cálculo para ingeniería civil. Croquis con cotas vivas, procedimiento didáctico y verificación normativa.

## Producción

**Host único:** [https://ingenieria.miacademiapreu.com](https://ingenieria.miacademiapreu.com)

No existe `calculos.miacademiapreu.com` ni otros subdominios de esta app.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Publicar (build + VPS + GitHub)

**Doble clic** en `Publicar.cmd` (raíz del proyecto) o en el acceso **Publicar MemoriaCalc** del Escritorio.

Eso identifica lo que cambió respecto de HEAD, compila, sube al VPS y hace commit + push en GitHub. La ventana se queda abierta para ver ANTES / DESPUÉS.

Desde terminal, equivalente:

```powershell
python scripts/publicar.py
```

También: `npm run publicar` o `.\scripts\publicar.ps1`.

El script imprime **ANTES** (commit actual + archivos sucios + diff) y **DESPUÉS** (commit nuevo, VPS y GitHub). Si no pasas `-m`, arma el mensaje a partir de los archivos cambiados.

| Flag | Efecto |
| --- | --- |
| `-m "…"` | Mensaje de commit propio (el porqué) |
| `--sin-vps` | Solo build + GitHub |
| `--sin-git` | Solo build + VPS |
| `--solo-build` | Solo `npm run build` |
| `--dry-run` | Muestra el antes y el plan |

El VPS usa `VPS_PASS` (o la llave SSH del agente). El sitio público es siempre `ingenieria.miacademiapreu.com`. Tras el deploy: Ctrl+F5.

## Despliegue (VPS, detalle)

1. `npm install && npm run build`
2. `python scripts/deploy-control-ingenieria.py` (DocumentRoot `/var/www/ingenieria`)
3. Culqi: `deploy/memorcalc-culqi.service` + `/etc/memorcalc-culqi.env`

Detalle en `/despliegue`.

## Supabase

- MemoriaCalc: `kxiunxdjtaesswgexsij` → `supabase/schema.sql`
- Folio (Plan Pro / nube): `npm run supabase:usuarios`
