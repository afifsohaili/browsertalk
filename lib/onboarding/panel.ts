import { browser } from 'wxt/browser';

/** `sidePanel.open()` needs a user gesture; call this from a click handler only. */
export async function openSidePanel(): Promise<boolean> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId === undefined) return false;
    await browser.sidePanel.open({ windowId: tab.windowId });
    return true;
  } catch {
    return false;
  }
}
