[CmdletBinding()]
param(
    [string]$ApplicationPath = (Join-Path $env:LOCALAPPDATA 'Vivaldi\Application'),
    [Alias('EnableAutoUpdate')]
    [switch]$CreateShortcut,
    [switch]$Launch
)

$ErrorActionPreference = 'Stop'

try {
    $ApplicationPath = (Resolve-Path -LiteralPath $ApplicationPath).Path
    $vivaldi = Join-Path $ApplicationPath 'vivaldi.exe'
    if (($CreateShortcut -or $Launch) -and
        -not (Test-Path -LiteralPath $vivaldi -PathType Leaf)) {
        throw "Vivaldi executable not found at $vivaldi."
    }

    if ($CreateShortcut) {
        $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $desktop = [Environment]::GetFolderPath('Desktop')
        $startMenuShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Vivaldi.lnk'
        $shortcutBackup = "$startMenuShortcut.website-blocker.bak"
        if ((Test-Path -LiteralPath $startMenuShortcut -PathType Leaf) -and
            -not (Test-Path -LiteralPath $shortcutBackup)) {
            Copy-Item -LiteralPath $startMenuShortcut -Destination $shortcutBackup
        }

        $shell = New-Object -ComObject WScript.Shell
        foreach ($shortcutPath in @((Join-Path $desktop 'Vivaldi Website Blocker.lnk'), $startMenuShortcut)) {
            $shortcut = $shell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $powershell
            # shortcut: the launcher uses this folder; rerun -CreateShortcut after moving it.
            $shortcut.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -Launch -ApplicationPath "{1}"' -f $PSCommandPath, $ApplicationPath
            $shortcut.WorkingDirectory = $PSScriptRoot
            $shortcut.IconLocation = "$vivaldi,0"
            $shortcut.Description = 'Repair the local website blocker, then open Vivaldi.'
            $shortcut.Save()
        }

        Write-Output 'Desktop and Vivaldi Start menu shortcuts updated. Existing scheduled tasks are unchanged.'
        return
    }

    $modFiles = @('website-blocker-blocked.html', 'website-blocker.js')
    foreach ($name in $modFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $name) -PathType Leaf)) {
            throw "Missing $name. Keep both mod files beside install.ps1."
        }
    }

    $version = Get-ChildItem -LiteralPath $ApplicationPath -Directory |
        Where-Object {
            $_.Name -match '^\d+\.\d+\.\d+\.\d+$' -and
            (Test-Path -LiteralPath (Join-Path $_.FullName 'resources\vivaldi\window.html') -PathType Leaf)
        } |
        Sort-Object { [version]$_.Name } -Descending |
        Select-Object -First 1
    if (-not $version) { throw "No complete Vivaldi installation found under $ApplicationPath." }

    $resourcePath = Join-Path $version.FullName 'resources\vivaldi'
    $windowFile = Join-Path $resourcePath 'window.html'
    $original = [System.IO.File]::ReadAllText($windowFile)
    $scriptPattern = '(?is)<script\b[^>]*\bsrc\s*=\s*["''](?:\./)?website-blocker\.js(?:[?#][^"'']*)?["''][^>]*>'
    $needsHook = $original -notmatch $scriptPattern
    if ($needsHook -and $original -notmatch '(?i)</body\s*>') {
        throw "No closing body tag in $windowFile. Refusing to modify an unfamiliar document."
    }

    foreach ($name in $modFiles) {
        $source = Join-Path $PSScriptRoot $name
        $destination = Join-Path $resourcePath $name
        if (-not (Test-Path -LiteralPath $destination) -or
            (Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $destination).Hash) {
            Copy-Item -LiteralPath $source -Destination $destination -Force
        }
    }

    if ($needsHook) {
        $newline = if ($original.Contains("`r`n")) { "`r`n" } else { "`n" }
        $hook = '<script src="website-blocker.js"></script>' + $newline
        $updated = [regex]::Replace($original, '(?i)</body\s*>', $hook + '$0')
        $backup = "$windowFile.website-blocker.bak"
        if (Test-Path -LiteralPath $backup) { $backup = $null }
        $temporary = Join-Path $resourcePath ('.website-blocker-' + [guid]::NewGuid() + '.tmp')
        try {
            [System.IO.File]::WriteAllText($temporary, $updated, [System.Text.UTF8Encoding]::new($false))
            if ([System.IO.File]::ReadAllText($windowFile) -cne $original) {
                throw 'window.html changed during installation. Run the installer again when the update finishes.'
            }
            [System.IO.File]::Replace($temporary, $windowFile, $backup)
        } finally {
            if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
        }
    }
    Write-Output "Website blocker installed for Vivaldi $($version.Name). Restart Vivaldi to load changes."

    if ($Launch) {
        Start-Process -FilePath $vivaldi
    }
} catch {
    if ($Launch) {
        $shell = New-Object -ComObject WScript.Shell
        $shell.Popup("Vivaldi was not opened.`n`n$($_.Exception.Message)", 0, 'Vivaldi Website Blocker', 16) | Out-Null
    }

    Write-Error $_ -ErrorAction Continue
    exit 1
}
