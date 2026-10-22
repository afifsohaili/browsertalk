import { browser } from 'wxt/browser';
import { setSetupBadge, syncSetupBadge } from './badge';
import { openWelcomeTab } from './welcome';

/** Only a normal first install opens the setup tab. Updates and dev/admin installs stay quiet. */
export function shouldOpenWelcome(reason: string, installType: string | null): boolean {
  if (reason !== 'install') return false;
  return installType !== 'development' && installType !== 'admin';
}

export async function installedInstallType(): Promise<string | null> {
  try {
    const self = await browser.management.getSelf();
    return self.installType ?? null;
  } catch {
    return null;
  }
}

export async function handleInstalled(details: { reason: string }): Promise<void> {
  const installType = await installedInstallType();
  if (!shouldOpenWelcome(details.reason, installType)) return;

  await setSetupBadge();
  await openWelcomeTab();
}

/**
 * Registers synchronously so `onInstalled` is not missed while the background awaits migrations.
 * The startup probe restores the setup badge when the connection is still not ready.
 */
export function registerOnboardingHandler(): void {
  browser.runtime.onInstalled.addListener((details) => handleInstalled(details));
  browser.runtime.onStartup.addListener(() => syncSetupBadge());
}
