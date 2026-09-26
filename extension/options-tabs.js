const settingsTabs = [...document.querySelectorAll('[role="tab"][data-tab]')];
const legacyTabs = { library: "general", appearance: "general", shortcuts: "saving", permissions: "images" };

function selectSettingsTab(key, focus = false) {
  const selected = settingsTabs.find((tab) => tab.dataset.tab === (legacyTabs[key] ?? key)) ?? settingsTabs[0];
  for (const tab of settingsTabs) {
    const active = tab === selected;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !active;
  }
  if (focus) {
    selected.focus({ preventScroll: true });
    const contentTop = document.querySelector(".settings-layout").getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > contentTop - 24) window.scrollTo(0, Math.max(0, contentTop - 24));
  }
  history.replaceState(null, "", `#${selected.dataset.tab}`);
}

for (const tab of settingsTabs) {
  tab.addEventListener("click", () => selectSettingsTab(tab.dataset.tab, true));
  tab.addEventListener("keydown", (event) => {
    const index = settingsTabs.indexOf(tab);
    let next;
    if (event.key === "ArrowDown") next = (index + 1) % settingsTabs.length;
    if (event.key === "ArrowUp") next = (index - 1 + settingsTabs.length) % settingsTabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = settingsTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectSettingsTab(settingsTabs[next].dataset.tab, true);
  });
}
selectSettingsTab(location.hash.slice(1));
window.addEventListener("hashchange", () => selectSettingsTab(location.hash.slice(1), true));
