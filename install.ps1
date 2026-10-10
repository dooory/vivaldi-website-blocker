[CmdletBinding()]
param(
    [string]$ApplicationPath = (Join-Path $env:LOCALAPPDATA 'Vivaldi\Application'),
    [switch]$EnableAutoUpdate
)

$ErrorActionPreference = 'Stop'
$taskName = 'Vivaldi Website Blocker'

try {
    $ApplicationPath = (Resolve-Path -LiteralPath $ApplicationPath).Path
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

    if ($EnableAutoUpdate) {
        $account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        # shortcut: the task runs from this folder; rerun -EnableAutoUpdate after moving it.
        $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -ApplicationPath "{1}"' -f $PSCommandPath, $ApplicationPath
        $action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
        $triggers = @(
            (New-ScheduledTaskTrigger -AtLogOn -User $account),
            (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1))
        )
        $principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
        $settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -MultipleInstances IgnoreNew `
            -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 1)
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal `
            -Settings $settings -Description 'Reapply the local website blocker after Vivaldi updates. Does not download files or restart the browser.' -Force | Out-Null
        Write-Output "Automatic reinstallation enabled: $taskName. Keep this project folder in place."
    }
} catch {
    Write-Error $_
    exit 1
}
