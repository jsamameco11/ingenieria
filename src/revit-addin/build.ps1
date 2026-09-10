$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path (Split-Path $root -Parent) -Parent
$out = Join-Path $root "dist"
$bundle = Join-Path $out "MemoriaCalc.bundle"
$kit = Join-Path $repo "public\addin"

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force -Path $out | Out-Null
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "iconos.ps1")
$icons = Join-Path $root "icons"

$years = @("2023", "2024", "2025", "2026")
foreach ($year in $years) {
  Write-Host "Compilando plugin Revit $year..."
  $dest = Join-Path $out $year
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  dotnet publish (Join-Path $root "MemoriaCalc.Revit\MemoriaCalc.Revit.csproj") -c Release -p:RevitYear=$year -o $dest --nologo
  if ($LASTEXITCODE -ne 0) { throw "Fallo al compilar el plugin de Revit $year." }
  Copy-Item (Join-Path $root "MemoriaCalc.Revit.addin") (Join-Path $dest "MemoriaCalc.Revit.addin") -Force
  if ([int]$year -ge 2025) {
    Copy-Item (Join-Path $root "MemoriaCalc.Revit.runtimeconfig.json") (Join-Path $dest "MemoriaCalc.Revit.runtimeconfig.json") -Force
  }
  if (Test-Path $icons) { Copy-Item (Join-Path $icons "mc_*.png") $dest -Force }
  Get-ChildItem $dest -Filter "Nice3point*" -ErrorAction SilentlyContinue | Remove-Item -Force
  Get-ChildItem $dest -Filter "*.pdb" -ErrorAction SilentlyContinue | Remove-Item -Force
  Get-ChildItem $dest -Filter "*.deps.json" -ErrorAction SilentlyContinue | Remove-Item -Force
}

New-Item -ItemType Directory -Force -Path (Join-Path $bundle "Contents") | Out-Null
Copy-Item (Join-Path $root "PackageContents.xml") (Join-Path $bundle "PackageContents.xml") -Force
foreach ($year in $years) {
  Copy-Item -Recurse (Join-Path $out $year) (Join-Path $bundle "Contents\$year")
}

$bundleZip = Join-Path $root "MemoriaCalc.Revit.Setup\bundle.zip"
if (Test-Path $bundleZip) { Remove-Item $bundleZip -Force }
Compress-Archive -Path (Join-Path $bundle "*") -DestinationPath $bundleZip -Force

Write-Host "Compilando instalador Windows..."
$setupOut = Join-Path $out "setup"
New-Item -ItemType Directory -Force -Path $setupOut | Out-Null
dotnet publish (Join-Path $root "MemoriaCalc.Revit.Setup\MemoriaCalc.Revit.Setup.csproj") -c Release -o $setupOut --nologo
if ($LASTEXITCODE -ne 0) { throw "Fallo al compilar el instalador." }

New-Item -ItemType Directory -Force -Path $kit | Out-Null
Copy-Item (Join-Path $setupOut "MemoriaCalc.Revit.Setup.exe") (Join-Path $kit "MemoriaCalc.Revit.Setup.exe") -Force
if (Test-Path (Join-Path $kit "MemoriaCalc.bundle")) { Remove-Item -Recurse -Force (Join-Path $kit "MemoriaCalc.bundle") }
Copy-Item -Recurse $bundle (Join-Path $kit "MemoriaCalc.bundle")
Copy-Item (Join-Path $root "MemoriaCalc.Revit.addin") (Join-Path $kit "MemoriaCalc.Revit.addin") -Force
Copy-Item (Join-Path $root "PackageContents.xml") (Join-Path $kit "PackageContents.xml") -Force

$release = @{
  version = "2.0.0"
  schema = "memoriacalc.revit.v1"
  publishedAt = "2026-09-06"
  notes = "Add-in de Revit con panel acoplable. Conecta, analiza y sincroniza metrados en vivo."
  available = $true
  sizeLabel = "instalador"
  setupUrl = "/addin/MemoriaCalc.Revit.Setup.exe"
  urls = @{
    "2023" = "/addin/MemoriaCalc.Revit.Setup.exe"
    "2024" = "/addin/MemoriaCalc.Revit.Setup.exe"
    "2025" = "/addin/MemoriaCalc.Revit.Setup.exe"
    "2026" = "/addin/MemoriaCalc.Revit.Setup.exe"
  }
}
$release | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $kit "release.json")

$zip = Join-Path $kit "MemoriaCalc-Revit-Addin.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
$stage = Join-Path $root "kit-zip"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item (Join-Path $kit "MemoriaCalc.Revit.Setup.exe") $stage
Copy-Item (Join-Path $kit "release.json") $stage
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
Remove-Item -Recurse -Force $stage

Write-Host "Instalador: $kit\MemoriaCalc.Revit.Setup.exe"
Write-Host "Bundle: $kit\MemoriaCalc.bundle"
