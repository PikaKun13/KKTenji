# Export all pptx slides to PNG via local PowerPoint COM (design doc section 9).
# ASCII only: Windows PowerShell 5.1 misparses UTF-8 without BOM.
param(
  [Parameter(Mandatory = $true)][string]$Pptx,
  [Parameter(Mandatory = $true)][string]$OutDir
)

# If the user already has PowerPoint open, COM attaches to that instance.
# In that case we must NOT Quit() it (would close the user's presentations).
$ownsApp = $true
try {
  $null = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
  $ownsApp = $false
} catch {
  $ownsApp = $true
}

try {
  $app = New-Object -ComObject PowerPoint.Application
} catch {
  Write-Output 'ERROR NO_OFFICE'
  exit 1
}

$pres = $null
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
  Write-Output "DONE $n"
} catch {
  Write-Output "ERROR $($_.Exception.Message)"
  exit 1
} finally {
  if ($null -ne $pres) {
    try { $pres.Close() } catch {}
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($pres)
  }
  if ($ownsApp) {
    try { $app.Quit() } catch {}
  }
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
