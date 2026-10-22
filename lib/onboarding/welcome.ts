import { browser } from 'wxt/browser';

export const WELCOME_PATH = '/welcome.html';

export function welcomeUrl(): string {
  return browser.runtime.getURL(WELCOME_PATH);
}

/** Opens the setup tab. Also the panel card's reopen path when the tab was closed. */
export async function openWelcomeTab(): Promise<void> {
  await browser.tabs.create({ url: welcomeUrl() });
}
