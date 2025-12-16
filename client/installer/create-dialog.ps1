Add-Type -AssemblyName System.Drawing
$img = New-Object System.Drawing.Bitmap(493, 312)
$g = [System.Drawing.Graphics]::FromImage($img)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 120, 215))
$g.FillRectangle($brush, 0, 0, 493, 312)
$img.Save("$PSScriptRoot\dialog.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$g.Dispose()
$img.Dispose()
Write-Host "Created dialog.bmp"
