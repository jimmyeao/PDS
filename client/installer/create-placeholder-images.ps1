# Create Placeholder BMP Images for WiX Installer
# This script generates simple placeholder banner and dialog images
# For production, replace these with professional branded images

Add-Type -AssemblyName System.Drawing

# Banner Image (493x58 pixels)
$bannerWidth = 493
$bannerHeight = 58
Write-Host "Creating banner placeholder $bannerWidth x $bannerHeight..."
$banner = New-Object System.Drawing.Bitmap($bannerWidth, $bannerHeight)
$graphics = [System.Drawing.Graphics]::FromImage($banner)

# Fill with gradient (blue theme)
$brush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 120, 215))
$graphics.FillRectangle($brush1, 0, 0, 493, 58)

# Add text
$font = New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Bold)
$brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.DrawString("Kiosk Digital Signage Client", $font, $brush2, 10, 15)

# Save
$banner.Save("$PSScriptRoot\banner.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$graphics.Dispose()
$banner.Dispose()
Write-Host "✓ Created banner.bmp"

# Dialog Image (493x312 pixels)
$dialogWidth = 493
$dialogHeight = 312
Write-Host "Creating dialog placeholder $dialogWidth x $dialogHeight..."
$dialog = New-Object System.Drawing.Bitmap($dialogWidth, $dialogHeight)
$graphics = [System.Drawing.Graphics]::FromImage($dialog)

# Fill with white
$brush3 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.FillRectangle($brush3, 0, 0, 493, 312)

# Add blue sidebar (164 pixels wide - standard WiX dialog layout)
$brush4 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 120, 215))
$graphics.FillRectangle($brush4, 0, 0, 164, 312)

# Add text on sidebar
$font2 = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)
$brush5 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.DrawString("Kiosk", $font2, $brush5, 20, 20)
$graphics.DrawString("Digital", $font2, $brush5, 20, 50)
$graphics.DrawString("Signage", $font2, $brush5, 20, 80)
$graphics.DrawString("Client", $font2, $brush5, 20, 110)

# Save
$dialog.Save("$PSScriptRoot\dialog.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$graphics.Dispose()
$dialog.Dispose()
Write-Host "✓ Created dialog.bmp"

Write-Host "`n✅ Placeholder images created successfully!"
Write-Host "For production, replace with professionally designed images:"
Write-Host "  - banner.bmp (493x58 pixels)"
Write-Host "  - dialog.bmp (493x312 pixels)"
