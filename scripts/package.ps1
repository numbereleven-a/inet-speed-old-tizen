param(
    [string]$TizenCli = 'tizen',
    [string]$CertificateProfile = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & node scripts/check.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Source checks failed.' }
    & node --test tests/engine.test.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Engine tests failed.' }
    [xml]$manifest = [System.IO.File]::ReadAllText((Join-Path $projectRoot 'app/config.xml'))
    $version = $manifest.widget.version
    $destination = Join-Path $projectRoot ('artifacts/' + $version)
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    $suffix = if ($CertificateProfile) { 'signed' } else { 'resign-required' }
    $package = Join-Path $destination ('inet-speed-old-tizen-' + $version + '-' + $suffix + '.wgt')
    if (Test-Path -LiteralPath $package) { throw 'This version already has a package. Keep it and increment the version before building again.' }
    $buildRoot = Join-Path $projectRoot 'app/.buildResult'
    & $TizenCli build-web -e icon.svg -- app
    if ($LASTEXITCODE -ne 0) { throw 'Tizen build failed.' }
    $temporaryPackage = Join-Path $destination ('.package-' + [Guid]::NewGuid().ToString('N') + '.wgt')
    try {
        if ($CertificateProfile) {
            & $TizenCli package -t wgt -s $CertificateProfile -- app/.buildResult
            if ($LASTEXITCODE -ne 0) { throw 'Signing failed.' }
            $built = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'app/.buildResult') -Filter '*.wgt'
            if ($built.Count -ne 1) { throw 'Expected exactly one signed package.' }
            Copy-Item -LiteralPath $built[0].FullName -Destination $temporaryPackage
        } else {
            # A WGT is a ZIP. This unsigned archive must be signed for the target TV.
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $archive = [System.IO.Compression.ZipFile]::Open($temporaryPackage, 'Create')
            try {
                foreach ($file in Get-ChildItem -LiteralPath $buildRoot -File -Recurse) {
                    $relative = $file.FullName.Substring($buildRoot.Length + 1).Replace('\', '/')
                    if ($relative -match '(^|/)(author-signature\.xml|signature[0-9]+\.xml)$' -or $relative -match '\.wgt$') { continue }
                    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, 'Optimal') | Out-Null
                }
            } finally { $archive.Dispose() }
        }
        Move-Item -LiteralPath $temporaryPackage -Destination $package
    } finally {
        if (Test-Path -LiteralPath $temporaryPackage) { Remove-Item -LiteralPath $temporaryPackage -Force }
    }
    Write-Output ('Created ' + [System.IO.Path]::GetFileName($package))
} finally { Pop-Location }
