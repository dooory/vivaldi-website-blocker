# Vivaldi website blocker

A JavaScript UI mod for desktop Vivaldi. Click **Block sites** in the address toolbar to add or remove domains. Blocked tabs redirect to a local **Site blocked** page.

Blocking `youtube.com` also blocks its subdomains. Blocking `music.youtube.com` covers only that subdomain and its children. You can paste a URL, but its path, port, and query are ignored. Rules are saved per profile and apply immediately, including to open tabs, in normal windows, private windows, and Web Panels.

## Install

### Windows shortcut

Keep this repository in a permanent folder and run from it:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -CreateShortcut
```

This creates Desktop and Start menu shortcuts named **Vivaldi Website Blocker**. Each launch repairs the mod files and the `window.html` script tag from this folder, then opens Vivaldi; if repair fails, it shows an error instead. Before its first edit, the installer backs up `window.html` to `window.html.website-blocker.bak`, and it keeps any other changes in that file.

Launching Vivaldi any other way, such as another shortcut, a taskbar pin, a link, or an updater restart, skips repair. Repairs load only after a full restart, so if the blocker goes missing after an update, quit Vivaldi completely and reopen it through the shortcut.

For a non-default installation, add `-ApplicationPath 'D:\Vivaldi\Application'` (the default is `%LOCALAPPDATA%\Vivaldi\Application`). Omit `-CreateShortcut` to install once without shortcuts. Rerun the command after moving the folder. Delete both shortcuts before uninstalling, or they will reinstall the mod.

### Manual

1. In `vivaldi://about`, find **Executable Path** and open the matching version's `resources\vivaldi` folder, usually `%LOCALAPPDATA%\Vivaldi\Application\<version>\resources\vivaldi\`.
2. Close Vivaldi and back up `window.html`.
3. Copy `website-blocker.js` and `website-blocker-blocked.html` into that folder.
4. Add `<script src="website-blocker.js"></script>` immediately before `</body>` in `window.html`.

Vivaldi updates replace the versioned folder, so repeat these steps after each update. To uninstall, remove the script line and both files. Saved rules stay in the profile.

## Limits

The mod redirects tabs instead of blocking network requests, so a site can start loading before the redirect. Adding a rule can discard unsaved work in matching open tabs. Only HTTP(S) navigation is checked. The browser UI console logs `[Website blocker] Blocked youtube.com in tab 123.` when the blocked page loads.

It was built against Vivaldi 8.2.4133.84. Live installation, private windows, and Web Panel redirects are unverified, and Vivaldi updates or other UI mods may break it.

## Development

There are no dependencies or build steps. API references: [Tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs), [Storage](https://developer.chrome.com/docs/extensions/reference/api/storage), and [incognito storage behavior](https://developer.chrome.com/docs/extensions/reference/manifest/incognito). The `window.html` installation approach comes from [VivaldiMods](https://github.com/jms830/VivaldiMods).

## License

MIT. See [LICENSE](LICENSE).
