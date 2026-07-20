# Build a classic multi-size 32bpp BMP ICO for KKTenji (ASCII only, PS 5.1 safe)
Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $p = New-Object Drawing.Drawing2D.GraphicsPath
  $d = $r*2
  $p.AddArc($x,$y,$d,$d,180,90)
  $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90)
  $p.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $p.CloseFigure()
  return $p
}

function Draw-Logo([Drawing.Graphics]$g,[float]$s){
  $g.SmoothingMode = 'AntiAlias'
  $bg = New-Object Drawing.Drawing2D.LinearGradientBrush(
    [Drawing.Point]::new(0,0),[Drawing.Point]::new([int](256*$s),[int](256*$s)),
    [Drawing.Color]::FromArgb(43,124,163),[Drawing.Color]::FromArgb(18,60,80))
  $g.FillPath($bg,(New-RoundedPath (14*$s) (14*$s) (228*$s) (228*$s) (54*$s)))
  $pen = New-Object Drawing.Pen([Drawing.Color]::FromArgb(235,255,255,255),[Math]::Max(1.0,11*$s))
  $pen.StartCap='Round'; $pen.EndCap='Round'
  $g.DrawBezier($pen,104*$s,128*$s,138*$s,128*$s,138*$s,82*$s,172*$s,82*$s)
  $g.DrawBezier($pen,104*$s,128*$s,138*$s,128*$s,138*$s,174*$s,172*$s,174*$s)
  $w = [Drawing.Brushes]::White
  $g.FillPath($w,(New-RoundedPath (48*$s) (102*$s) (58*$s) (52*$s) (13*$s)))
  $g.FillPath($w,(New-RoundedPath (166*$s) (60*$s) (46*$s) (42*$s) (10*$s)))
  $g.FillPath($w,(New-RoundedPath (166*$s) (152*$s) (46*$s) (42*$s) (10*$s)))
}

function Get-IconEntryBytes([int]$size){
  $bmp = New-Object Drawing.Bitmap -ArgumentList $size,$size,([Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [Drawing.Graphics]::FromImage($bmp)
  Draw-Logo $g ($size/256.0)
  $g.Dispose()
  $rect = New-Object Drawing.Rectangle 0,0,$size,$size
  $data = $bmp.LockBits($rect,[Drawing.Imaging.ImageLockMode]::ReadOnly,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $data.Stride
  $pixels = New-Object byte[] ($stride*$size)
  [Runtime.InteropServices.Marshal]::Copy($data.Scan0,$pixels,0,$pixels.Length)
  $bmp.UnlockBits($data)
  $bmp.Dispose()

  $ms = New-Object IO.MemoryStream
  $bw = New-Object IO.BinaryWriter($ms)
  # BITMAPINFOHEADER (height doubled for XOR+AND)
  $bw.Write([uint32]40); $bw.Write([int32]$size); $bw.Write([int32]($size*2))
  $bw.Write([uint16]1); $bw.Write([uint16]32); $bw.Write([uint32]0)
  $maskRow = [int]([Math]::Ceiling($size/32.0)*4)
  $bw.Write([uint32]($size*$size*4 + $maskRow*$size))
  $bw.Write([int32]0); $bw.Write([int32]0); $bw.Write([uint32]0); $bw.Write([uint32]0)
  # XOR: bottom-up BGRA rows
  for ($y = $size-1; $y -ge 0; $y--) {
    $bw.Write($pixels, $y*$stride, $size*4)
  }
  # AND mask: all zero (alpha handles transparency)
  $zero = New-Object byte[] ($maskRow)
  for ($y = 0; $y -lt $size; $y++) { $bw.Write($zero) }
  $bw.Flush()
  Write-Output -NoEnumerate $ms.ToArray()
}

$sizes = @(16,32,48,256)
$entries = @()
foreach ($sz in $sizes) {
  [byte[]]$e = Get-IconEntryBytes $sz
  Write-Output ("entry " + $sz + ": " + $e.Length + " bytes")
  $entries += ,$e
}

$out = New-Object IO.MemoryStream
$w = New-Object IO.BinaryWriter($out)
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$sizes.Count)
$offset = 6 + 16*$sizes.Count
for ($i=0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]
  $b = if ($s -ge 256) { 0 } else { $s }
  $w.Write([byte]$b); $w.Write([byte]$b); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([uint16]1); $w.Write([uint16]32)
  $w.Write([uint32]$entries[$i].Length); $w.Write([uint32]$offset)
  $offset += $entries[$i].Length
}
foreach ($e in $entries) { $w.Write([byte[]]$e) }
$w.Flush()
[IO.File]::WriteAllBytes('c:\Share\Tenji\build\icon.ico', $out.ToArray())
Write-Output ("ICO bytes: " + (Get-Item c:\Share\Tenji\build\icon.ico).Length)
