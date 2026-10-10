import { PerDaySessionStrategy } from './per-day';
import { StickySessionStrategy } from './sticky';
import { registerSessionStrategy } from './registry';

export function registerBuiltinSessionStrategies(): void {
  registerSessionStrategy('per-day', () => new PerDaySessionStrategy());
  registerSessionStrategy('sticky', () => new StickySessionStrategy());
}
