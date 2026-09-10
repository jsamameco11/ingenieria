Add-Type -AssemblyName System.Drawing
function New-Icon([string]$path, [int]$size, [string]$kind) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(18, 38, 58))
  $gold = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(196, 160, 86))
  $cream = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(243, 239, 228))
  if ($kind -eq "export") {
    $g.FillRectangle($gold, [int]($size*0.22), [int]($size*0.18), [int]($size*0.56), [int]($size*0.64))
    $g.FillRectangle($cream, [int]($size*0.34), [int]($size*0.34), [int]($size*0.32), [int]($size*0.12))
  } elseif ($kind -eq "update") {
    $pen = New-Object System.Drawing.Pen $gold, ([Math]::Max(2, $size/8))
    $g.DrawArc($pen, [int]($size*0.18), [int]($size*0.18), [int]($size*0.64), [int]($size*0.64), 40, 260)
    $g.FillPolygon($gold, @(
      (New-Object System.Drawing.Point ([int]($size*0.72), [int]($size*0.18))),
      (New-Object System.Drawing.Point ([int]($size*0.92), [int]($size*0.36))),
      (New-Object System.Drawing.Point ([int]($size*0.58), [int]($size*0.40)))
    ))
    $pen.Dispose()
  } else {
    $g.FillEllipse($gold, [int]($size*0.18), [int]($size*0.18), [int]($size*0.64), [int]($size*0.64))
    $font = New-Object System.Drawing.Font "Segoe UI", ([Math]::Max(7, $size/2.6)), ([System.Drawing.FontStyle]::Bold)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("i", $font, $cream, (New-Object System.Drawing.RectangleF 0,0,$size,$size), $sf)
    $font.Dispose()
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $gold.Dispose(); $cream.Dispose()
}
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir = Join-Path $root "icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
New-Icon (Join-Path $dir "mc_export_32.png") 32 export
New-Icon (Join-Path $dir "mc_export_16.png") 16 export
New-Icon (Join-Path $dir "mc_about_32.png") 32 about
New-Icon (Join-Path $dir "mc_about_16.png") 16 about
New-Icon (Join-Path $dir "mc_update_32.png") 32 update
New-Icon (Join-Path $dir "mc_update_16.png") 16 update
