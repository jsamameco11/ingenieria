# Plugin MemoriaCalc para Autodesk Revit

Add-in de Autodesk (bundle `ApplicationPlugins`). Revit lo carga al abrir: cinta **MemoriaCalc** y **Add-Ins → Herramientas externas**.

## Instalar (producción)

1. Descargue `MemoriaCalc.Revit.Setup.exe` (Plan Pro).
2. Pulse **Instalar plugin**.
3. Abra Revit. No es un script ni un `.bat`.

Ruta: `%APPDATA%\Autodesk\ApplicationPlugins\MemoriaCalc.bundle`

## Cinta

- **Exportar paquete** — UniqueId y metrados → `.mcrevit.json` para Vincular con Revit.
- **Actualizar plugin** — consulta `/addin/release.json` y abre el instalador si hay versión nueva.
- **Acerca de**

## Compilar

```powershell
powershell -ExecutionPolicy Bypass -File src\revit-addin\build.ps1
```
