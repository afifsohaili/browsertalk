export function formatElementCount(count: number | undefined): string {
  if (count === undefined || count <= 0) return '';
  return `${count} ${count === 1 ? 'element' : 'elements'}`;
}
