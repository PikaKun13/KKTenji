# pptx の全頁を PNG に書き出す（設計書 §9。ローカル PowerPoint の COM を使用）
param(
  [Parameter(Mandatory = $true)][string]$Pptx,
  [Parameter(Mandatory = $true)][string]$OutDir
)

try {
  $app = New-Object -ComObject PowerPoint.Application
} catch {
  Write-Output 'ERROR NO_OFFICE'
  exit 1
}

try {
  # Open(FileName, ReadOnly, Untitled, WithWindow)
  $pres = $app.Presentations.Open($Pptx, $true, $true, $false)
  $n = $pres.Slides.Count
  $w = 1920
  $h = [int](1920 * $pres.PageSetup.SlideHeight / $pres.PageSetup.SlideWidth)
  for ($i = 1; $i -le $n; $i++) {
    $out = Join-Path $OutDir ("p$i.png")
    $pres.Slides.Item($i).Export($out, 'PNG', $w, $h)
    Write-Output "PAGE $i/$n"
  }
  $pres.Close()
  Write-Output "DONE $n"
} catch {
  Write-Output "ERROR $($_.Exception.Message)"
  exit 1
} finally {
  $app.Quit() | Out-Null
}
