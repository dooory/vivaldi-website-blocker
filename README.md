# Vivaldi website blocker

A JavaScript UI mod for Vivaldi on desktop, with a local HTML page for blocked sites. Click **Block sites** in the address toolbar to add or remove blocked domains.

Adding `youtube.com` blocks that domain and all its subdomains, including `www.youtube.com` and `music.youtube.com`. Adding `music.youtube.com` only blocks that subdomain and its children. You can paste an HTTP(S) URL; paths, ports, and query strings do not narrow the rule.

Rules save locally in your Vivaldi profile and take effect immediately, including on matching tabs already open. Blocked tabs show a **Site blocked** page naming the domain. Removing a rule allows future navigation; navigate to the website again to reopen it.

The mod applies the same list to normal windows, private windows, and Web Panels. Editing the list in a private window changes the saved list too. Each browser profile has its own list.

## Install

### Repair-and-launch shortcut on Windows

Keep all the repository files in a permanent folder. Open PowerShell in that folder and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -CreateShortcut
```

This creates Desktop and Start menu shortcuts named **Vivaldi Website Blocker**, so searching for that name in Windows also finds it. Open Vivaldi through either shortcut to install or repair both mod files and the script tag before the browser starts. It uses the files in this folder, does not download anything, and creates no scheduled task or background watcher. If repair fails, it shows an error and does not open Vivaldi.

Setup leaves Vivaldi's own **Vivaldi** Start menu shortcut alone, because Vivaldi updates rewrite it. If an older setup replaced that shortcut, rerunning setup restores it from `Vivaldi.lnk.website-blocker.bak` or points it back to `vivaldi.exe`. This fixes extra tabs named `hidden` and `bypass` opening at startup.

The installer preserves other modifications to `window.html`, adds the script tag only when missing, and creates `window.html.website-blocker.bak` before its first edit. It copies mod files only when they differ. It does not close or restart an already-running Vivaldi. Fully quit the browser and reopen through the shortcut to load repaired files.

Other browser shortcuts, existing taskbar pins, web links, and updater restarts can bypass repair. An update can also install new resources during startup after the repair has run. If the blocker is missing after an update, fully quit Vivaldi and open it through a repair shortcut again.

The default installation path is `%LOCALAPPDATA%\Vivaldi\Application`. For a different installation, add `-ApplicationPath 'D:\Vivaldi\Application'`. Writing a system-wide installation may require an administrator; the shortcut uses your normal account permissions.

To install once without changing shortcuts or launching Vivaldi, omit `-CreateShortcut`. If you move this folder, run the command again from its new location to update both shortcuts. `-EnableAutoUpdate` remains an alias for `-CreateShortcut` for older setup commands.

Existing scheduled tasks are left untouched. If you previously enabled the every-minute task, it continues to run. To remove it yourself, run:

```powershell
Unregister-ScheduledTask -TaskName 'Vivaldi Website Blocker' -Confirm:$false
```

Before manually uninstalling the mod, delete both **Vivaldi Website Blocker** shortcuts and disable any old task, or they will reinstall it. Run `install.ps1` manually to see installation errors in PowerShell.

### Manual installation

1. Open `vivaldi://about` and find **Executable Path**. Use the matching version's `resources/vivaldi` folder. On Windows it is usually:

   ```text
   %LOCALAPPDATA%\Vivaldi\Application\<version>\resources\vivaldi\
   ```

2. Close all Vivaldi windows, then back up `window.html` from that folder.
3. Copy this repository's `website-blocker.js` and `website-blocker-blocked.html` into the same folder as `window.html`.
4. Edit `window.html` and add this line immediately before `</body>`:

   ```html
   <script src="website-blocker.js"></script>
   ```

5. Start Vivaldi. Click **Block sites** in the address toolbar, enter a domain, and click **Block site**. Keep the address toolbar visible to access the dialog. Press Escape or click **Done** to close it.

If you already load JavaScript mods through a mod loader, load `website-blocker.js` once in each browser UI window instead of adding another loader.

Vivaldi updates replace the versioned application resources. Copy both mod files and add the script line again in the new version's folder. The saved list remains in the profile. The Custom UI Modifications setting for CSS does not load JavaScript mods.

To uninstall, close Vivaldi and remove the script line and both mod files. Uninstalling leaves the saved rules in your profile; remove entries through the dialog beforehand if you want to clear them.

## Limits

This is a personal focus aid. It redirects tabs rather than blocking network requests, so a site can begin loading before the redirect. It uses a local HTML page as the destination and checks both committed and completed navigation. It works while the mod is loaded, and you can disable it by uninstalling it. It only checks HTTP(S) navigation.

The browser UI console logs `[Website blocker] Blocked youtube.com in tab 123.` once the blocked page commits or finishes loading. Accepting a redirect request alone does not produce a success message.

Adding a rule can discard unsaved work in matching open tabs. The blocked page does not store the original URL or page contents. No external service receives the blocklist.

The implementation uses APIs and toolbar structure found in Vivaldi 8.2.4133.84. Live installation, private-window enforcement, and Web Panel redirects have not been verified. Browser updates or other UI mods may require adjustments.

## Development

There are no runtime dependencies or build steps. Install the JavaScript and HTML files directly, or use the Windows installer. Testing is not run per the repository instructions.

API references: [Tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs), [Storage](https://developer.chrome.com/docs/extensions/reference/api/storage), and [incognito storage behavior](https://developer.chrome.com/docs/extensions/reference/manifest/incognito). JavaScript installation follows the `window.html` approach used by [VivaldiMods](https://github.com/jms830/VivaldiMods).

## License

MIT. See [LICENSE](LICENSE).
