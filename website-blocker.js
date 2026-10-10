(() => {
  "use strict";

  const PREFIX = "dooory.website-blocker.domain.";

  function normalizeDomain(input) {
    const value = input.trim();
    if (!value || /[\s*\\]/u.test(value)) throw new Error("Enter a domain or an HTTP(S) URL, without wildcards or spaces.");
    let url;
    try {
      url = new URL(/^https?:\/\//iu.test(value) ? value : `https://${value}`);
    } catch {
      throw new Error("Enter a valid domain or HTTP(S) URL.");
    }
    const domain = url.hostname.replace(/\.$/u, "").toLowerCase();
    if (!/^https?:$/u.test(url.protocol) || url.username || url.password || value.includes("://") && !/^https?:\/\//iu.test(value)) {
      throw new Error("Only domains and HTTP(S) URLs are supported; leave out usernames and passwords.");
    }
    if (!domain || domain.length > 253 || !domain.startsWith("[") && domain.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))) {
      throw new Error("Enter a valid hostname.");
    }
    return domain;
  }

  function matchingDomain(address, domains) {
    try {
      const url = new URL(address);
      if (!/^https?:$/u.test(url.protocol)) return;
      const hostname = url.hostname.replace(/\.$/u, "").toLowerCase();
      return [...domains].find(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
      return;
    }
  }

  function blockedPage(domain) {
    return chrome.runtime.getURL("website-blocker-blocked.html") + "?domain=" + encodeURIComponent(domain);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { normalizeDomain, matchingDomain, blockedPage };
    return;
  }
  if (location.pathname === "/website-blocker-blocked.html") {
    document.getElementById("blocked-domain").textContent = new URLSearchParams(location.search).get("domain") || "This website";
    return;
  }
  if (window.doooryWebsiteBlocker) return;
  window.doooryWebsiteBlocker = true;

  // Callback APIs also work in Vivaldi UI contexts that do not return promises.
  function call(owner, method, ...args) {
    return new Promise((resolve, reject) => {
      owner[method](...args, result => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
  }

  const domains = new Set();
  const redirecting = new Set();
  const pendingBlocks = new Map();
  let windowId;
  let ready = false;
  let startupError = "";
  const ownWindowId = () => window.vivaldiWindowId ?? windowId;
  const dialog = document.createElement("dialog");
  dialog.id = "dooory-website-blocker-dialog";
  dialog.setAttribute("aria-labelledby", "dooory-website-blocker-title");
  dialog.innerHTML = `<h2 id="dooory-website-blocker-title">Blocked websites</h2>
    <form><label for="dooory-website-blocker-input">Domain or website URL</label>
    <div class="entry"><input id="dooory-website-blocker-input" required maxlength="2048" placeholder="youtube.com" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="submit">Block site</button></div>
    <p>Blocks the whole domain and its subdomains, across windows and Web Panels. Paths and ports do not narrow the rule. Existing tabs will redirect immediately.</p></form>
    <p class="status" role="status" aria-live="polite"></p><ul aria-label="Blocked domains"></ul>
    <button type="button" class="close">Done</button>`;
  const input = dialog.querySelector("input");
  const form = dialog.querySelector("form");
  const submit = dialog.querySelector('[type="submit"]');
  const status = dialog.querySelector(".status");
  const list = dialog.querySelector("ul");

  function report(message) {
    status.textContent = message;
  }

  function render() {
    list.replaceChildren();
    if (!domains.size) {
      const empty = document.createElement("li");
      empty.textContent = "No sites blocked.";
      list.append(empty);
    }
    for (const domain of [...domains].sort()) {
      const row = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = domain;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Unblock ${domain}`);
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        try {
          await call(chrome.storage.local, "remove", PREFIX + domain);
          domains.delete(domain);
          render();
          report(`${domain} unblocked. Navigate to the site again to open it.`);
          input.focus();
        } catch (error) {
          report(`Could not remove the rule: ${error.message}`);
          remove.disabled = false;
        }
      });
      row.append(name, remove);
      list.append(row);
    }
    submit.disabled = !ready;
  }

  function confirmBlock(tabId, address) {
    const block = pendingBlocks.get(tabId);
    if (!block || address !== block.url) return;
    pendingBlocks.delete(tabId);
    console.log(`[Website blocker] Blocked ${block.domain} in tab ${tabId}.`);
  }

  async function enforce(tab, address = tab.pendingUrl || tab.url) {
    if (!ready || tab.windowId !== ownWindowId() || !Number.isInteger(tab.id) || tab.id < 0 || redirecting.has(tab.id)) return;
    const domain = matchingDomain(address, domains);
    if (!domain) return;
    const url = blockedPage(domain);
    pendingBlocks.set(tab.id, { domain, url });
    redirecting.add(tab.id);
    try {
      // shortcut: tab redirects can follow network requests; use an extension for request-level blocking.
      await call(chrome.tabs, "update", tab.id, { url });
    } catch (error) {
      pendingBlocks.delete(tab.id);
      report(`Could not redirect a blocked tab: ${error.message}`);
      console.error("Website blocker could not redirect a tab:", error);
    } finally {
      redirecting.delete(tab.id);
    }
  }

  async function enforceAll() {
    try {
      const tabs = await call(chrome.tabs, "query", { windowId: ownWindowId() });
      await Promise.all(tabs.map(tab => enforce(tab)));
    } catch (error) {
      report(`Could not check open tabs: ${error.message}`);
      console.error("Website blocker could not check tabs:", error);
    }
  }

  async function enforceNavigation(details) {
    if (!ready || details.frameId !== 0) return;
    confirmBlock(details.tabId, details.url);
    if (!matchingDomain(details.url, domains)) return;
    try {
      const tab = await call(chrome.tabs, "get", details.tabId);
      await enforce(tab, details.url);
    } catch (error) {
      report(`Could not check navigation: ${error.message}`);
      console.error("Website blocker could not check navigation:", error);
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!ready) return;
    let domain;
    try {
      domain = normalizeDomain(input.value);
      submit.disabled = true;
      await call(chrome.storage.local, "set", { [PREFIX + domain]: true });
      domains.add(domain);
      input.value = "";
      render();
      report(`${domain} blocked, including its subdomains.`);
      await enforceAll();
    } catch (error) {
      report(`Could not block the site: ${error.message}`);
    } finally {
      submit.disabled = !ready;
      input.focus();
    }
  });
  dialog.querySelector(".close").addEventListener("click", () => dialog.close());

  function mount() {
    if (!document.body) return;
    if (!dialog.isConnected) document.body.append(dialog);
    const toolbar = document.querySelector(".toolbar-mainbar.toolbar-addressbar");
    if (!toolbar || toolbar.querySelector("#dooory-website-blocker-button")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "button-toolbar";
    wrapper.id = "dooory-website-blocker-button";
    const button = document.createElement("button");
    button.type = "button";
    button.title = "Manage blocked websites";
    button.setAttribute("aria-haspopup", "dialog");
    button.textContent = "Block sites";
    button.addEventListener("click", () => {
      if (!ready) report(startupError || "Loading saved rules…");
      if (!dialog.open) dialog.showModal();
      input.focus();
    });
    wrapper.append(button);
    toolbar.append(wrapper);
  }

  const style = document.createElement("style");
  style.textContent = `
    #dooory-website-blocker-button button{padding:0 10px;white-space:nowrap}
    #dooory-website-blocker-dialog{color-scheme:light dark;box-sizing:border-box;width:min(480px,calc(100vw - 32px));max-height:85vh;overflow:auto;padding:24px;border:1px solid #8888;border-radius:12px;background:var(--colorBg,#fff);color:var(--colorFg,#222);font:14px/1.5 system-ui,sans-serif}
    #dooory-website-blocker-dialog::backdrop{background:#0008}
    #dooory-website-blocker-dialog h2{margin:0 0 16px;font-size:20px}
    #dooory-website-blocker-dialog label{display:block;margin-bottom:6px}
    #dooory-website-blocker-dialog .entry{display:flex;gap:8px;flex-wrap:wrap}
    #dooory-website-blocker-dialog input{flex:1;min-width:120px;padding:8px}
    #dooory-website-blocker-dialog button{cursor:pointer;padding:6px 12px;min-height:32px}
    #dooory-website-blocker-dialog :focus-visible{outline:2px solid var(--colorHighlightBg,#246bce);outline-offset:2px}
    #dooory-website-blocker-dialog ul{list-style:none;padding:0;max-height:35vh;overflow:auto}
    #dooory-website-blocker-dialog li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0}
    #dooory-website-blocker-dialog li span{overflow-wrap:anywhere;min-width:0}
    #dooory-website-blocker-dialog .status{min-height:1.5em}
    #dooory-website-blocker-dialog .close{float:right}`;
  document.head.append(style);
  render();
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
  mount();

  async function start() {
    try {
      // Vivaldi's UI window can differ from the window reported by getCurrent during startup.
      windowId = window.vivaldiWindowId ?? (await call(chrome.windows, "getCurrent")).id;
      // Each domain has its own key, so simultaneous edits in different windows do not replace the list.
      const saved = await call(chrome.storage.local, "get", null);
      for (const [key, value] of Object.entries(saved)) {
        if (!key.startsWith(PREFIX) || value !== true) continue;
        const domain = key.slice(PREFIX.length);
        try {
          if (normalizeDomain(domain) === domain) domains.add(domain);
        } catch { /* Ignore malformed saved rules. */ }
      }
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        let changed = false;
        for (const [key, change] of Object.entries(changes)) {
          if (!key.startsWith(PREFIX)) continue;
          const domain = key.slice(PREFIX.length);
          try {
            if (normalizeDomain(domain) !== domain) continue;
          } catch { continue; }
          if (change.newValue === true) domains.add(domain);
          else domains.delete(domain);
          changed = true;
        }
        if (changed) {
          render();
          void enforceAll();
        }
      });
      chrome.tabs.onCreated.addListener(tab => { void enforce(tab); });
      chrome.tabs.onUpdated.addListener((id, changes, tab) => {
        if (changes.status === "complete") confirmBlock(id, tab.url);
        if (changes.url || changes.status === "complete") void enforce(tab, changes.url || tab.pendingUrl || tab.url);
      });
      chrome.tabs.onRemoved.addListener(id => pendingBlocks.delete(id));
      chrome.webNavigation.onCommitted.addListener(enforceNavigation);
      chrome.webNavigation.onCompleted.addListener(enforceNavigation);
      chrome.webNavigation.onErrorOccurred.addListener(details => {
        const block = pendingBlocks.get(details.tabId);
        if (details.frameId !== 0 || !block || details.url !== block.url) return;
        pendingBlocks.delete(details.tabId);
        report(`Could not load the blocked page: ${details.error}`);
        console.error(`[Website blocker] Could not load the blocked page for ${block.domain}: ${details.error}`);
      });
      chrome.tabs.onReplaced.addListener(async id => {
        try { await enforce(await call(chrome.tabs, "get", id)); }
        catch (error) { console.error("Website blocker could not check a replaced tab:", error); }
      });
      ready = true;
      render();
      await enforceAll();
    } catch (error) {
      startupError = `Website blocker could not start: ${error.message}. Restart Vivaldi to retry.`;
      report(startupError);
      console.error(startupError);
    }
  }
  void start();
})();
