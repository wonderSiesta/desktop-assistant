$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$sourcePath = Join-Path $projectDir 'src\assets\whale-girl.png'
$outputDir = Join-Path $projectDir 'build-resources'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$source = [Drawing.Image]::FromFile($sourcePath)
$frames = [Collections.Generic.List[object]]::new()
try {
  foreach ($size in @(16,20,24,32,40,48,64,96,128,256)) {
    $bitmap = [Drawing.Bitmap]::new($size,$size,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $png = [IO.MemoryStream]::new()
    try {
      $graphics.Clear([Drawing.Color]::Transparent)
      $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($source,[Drawing.Rectangle]::new(0,0,$size,$size),0,0,$source.Width,$source.Height,[Drawing.GraphicsUnit]::Pixel)
      $bitmap.Save($png,[Drawing.Imaging.ImageFormat]::Png)
      $frames.Add([PSCustomObject]@{Size=$size;Data=$png.ToArray()})
      if ($size -eq 256) { [IO.File]::WriteAllBytes((Join-Path $outputDir 'desktop-assistant.png'),$png.ToArray()) }
    } finally { $graphics.Dispose();$bitmap.Dispose();$png.Dispose() }
  }
} finally { $source.Dispose() }
$stream = [IO.MemoryStream]::new()
$writer = [IO.BinaryWriter]::new($stream)
try {
  $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$frames.Count)
  $offset = 6 + 16 * $frames.Count
  foreach ($frame in $frames) {
    $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
    $writer.Write([byte]$dimension);$writer.Write([byte]$dimension)
    $writer.Write([byte]0);$writer.Write([byte]0)
    $writer.Write([uint16]1);$writer.Write([uint16]32)
    $writer.Write([uint32]$frame.Data.Length);$writer.Write([uint32]$offset)
    $offset += $frame.Data.Length
  }
  foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Data) }
  $writer.Flush()
  [IO.File]::WriteAllBytes((Join-Path $outputDir 'desktop-assistant.ico'),$stream.ToArray())
} finally { $writer.Dispose();$stream.Dispose() }
Write-Output 'Desktop Assistant icon created (16-256 px).'
