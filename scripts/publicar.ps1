# Publica MemoriaCalc: build, VPS e ingenieria.miacademiapreu.com, y GitHub.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
python "$PSScriptRoot\publicar.py" @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
