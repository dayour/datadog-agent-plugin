Add-Type -AssemblyName System.Drawing

$package = Join-Path $PSScriptRoot '..\appPackage'

$color = New-Object System.Drawing.Bitmap 192, 192
$graphics = [System.Drawing.Graphics]::FromImage($color)
try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(99, 44, 166))
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $font = New-Object System.Drawing.Font('Segoe UI', 92, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    try {
        $graphics.DrawString('D', $font, $brush, 46, 36)
    } finally {
        $brush.Dispose()
        $font.Dispose()
    }
    $color.Save((Join-Path $package 'color.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $color.Dispose()
}

$outline = New-Object System.Drawing.Bitmap 32, 32
$graphics = [System.Drawing.Graphics]::FromImage($outline)
try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 3
    try {
        $graphics.DrawEllipse($pen, 4, 4, 24, 24)
    } finally {
        $pen.Dispose()
    }
    $outline.Save((Join-Path $package 'outline.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $outline.Dispose()
}