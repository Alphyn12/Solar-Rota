$sourceFile = ".\Codex_Degisen_Dosyalar_FULL_CONTENT_2026-04-12.txt"
$projectRoot = (Get-Location).Path

if (-not (Test-Path $sourceFile)) {
    Write-Host "Kaynak dosya bulunamadi: $sourceFile"
    exit 1
}

$lines = Get-Content -Path $sourceFile -Encoding UTF8

$currentFile = $null
$buffer = New-Object System.Collections.Generic.List[string]
$written = 0

function Save-CurrentFile {
    param(
        [string]$RelativePath,
        [System.Collections.Generic.List[string]]$ContentLines,
        [string]$RootPath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        return 0
    }

    $targetPath = Join-Path $RootPath $RelativePath
    $targetDir = Split-Path $targetPath -Parent

    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    $contentText = [string]::Join([Environment]::NewLine, $ContentLines)

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($targetPath, $contentText, $utf8NoBom)

    Write-Host "Yazildi: $RelativePath (" $ContentLines.Count "satir )"
    return 1
}

foreach ($line in $lines) {
    if ($line -like "// FILE:*") {
        if ($null -ne $currentFile) {
            $written += Save-CurrentFile -RelativePath $currentFile -ContentLines $buffer -RootPath $projectRoot
        }

        $currentFile = $line.Substring(8).Trim()
        $buffer = New-Object System.Collections.Generic.List[string]
    }
    else {
        if ($null -ne $currentFile) {
            $buffer.Add($line)
        }
    }
}

if ($null -ne $currentFile) {
    $written += Save-CurrentFile -RelativePath $currentFile -ContentLines $buffer -RootPath $projectRoot
}

Write-Host ""
Write-Host "Tamamlandi. Toplam yazilan dosya sayisi: $written"