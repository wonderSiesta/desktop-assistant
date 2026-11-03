$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'pet-assets-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$proxy = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
$requestOptions = @{}
if ($proxy.ProxyEnable -eq 1 -and $proxy.ProxyServer -and $proxy.ProxyServer -notmatch '=') { $requestOptions.Proxy = 'http://' + $proxy.ProxyServer }
foreach ($asset in $manifest) {
  $target = [IO.Path]::GetFullPath((Join-Path $projectDir $asset.destination))
  if (-not $target.StartsWith((Join-Path $projectDir 'src\assets\pets\'),[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid asset destination.' }
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
  if (-not (Test-Path -LiteralPath $target)) {
    $encoded = ($asset.path.Split('/') | ForEach-Object {[Uri]::EscapeDataString($_)}) -join '/'
    Invoke-WebRequest -Uri ('https://raw.githubusercontent.com/' + $asset.repo + '/main/' + $encoded) -OutFile ($target + '.download') -UseBasicParsing @requestOptions
    Move-Item -LiteralPath ($target + '.download') -Destination $target
  }
  $bytes = [IO.File]::ReadAllBytes($target)
  $prefix = [Text.Encoding]::ASCII.GetBytes('blob ' + $bytes.Length + [char]0)
  $hash = [Security.Cryptography.SHA1]::Create()
  try { $actual = [BitConverter]::ToString($hash.ComputeHash([byte[]]($prefix + $bytes))).Replace('-','').ToLowerInvariant() } finally { $hash.Dispose() }
  if ($bytes.Length -ne $asset.size -or $actual -ne $asset.sha) { throw ('Asset verification failed: ' + $asset.destination) }
}
Write-Output ('Verified ' + $manifest.Count + ' animation files.')
