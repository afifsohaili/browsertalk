export function modifierLabel(platform: string, userAgent: string): string {
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(userAgent) ? '⌘' : 'Ctrl';
}
