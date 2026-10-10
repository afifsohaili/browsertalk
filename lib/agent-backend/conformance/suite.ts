import { beforeAll, beforeEach, describe, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { listSessionStrategies } from '@/lib/session-strategy/registry';
import { hasAgentBackend, registerAgentBackend } from '../registry';
import {
  checkAdmissionOnly,
  checkAdmissionReceipts,
  checkAuthHandling,
  checkConsentTiming,
  checkContract,
  checkCreationIntent,
  checkDeliveryMapping,
  checkImages,
  checkNaming,
  checkOpaqueSessionHandles,
  checkProjectDiscovery,
  checkRegistrySelection,
  checkTransportSecurity,
} from './checks';
import { ConformanceHarness } from './harness';
import type { AdapterConformanceCase } from './types';

export function describeAdapterConformance(adapter: AdapterConformanceCase): void {
  describe(`${adapter.label} — adapter conformance`, () => {
    const harness = new ConformanceHarness(adapter);

    beforeAll(() => {
      if (listSessionStrategies().length === 0) registerBuiltinSessionStrategies();
      if (!hasAgentBackend(adapter.id)) {
        registerAgentBackend(adapter.id, (config) => harness.backend(config));
      }
    });

    beforeEach(() => {
      fakeBrowser.reset();
      harness.reset();
    });

    it('declares a truthful six-axis contract', () => checkContract(harness));
    it('round-trips opaque session handles and distinguishes reuse from a fresh generation', () =>
      checkOpaqueSessionHandles(harness));
    it('serves project discovery only when it claims the capability, and manual binding still delivers', () =>
      checkProjectDiscovery(harness));
    it('authenticates through its onboarding and surfaces unauthorized', () => checkAuthHandling(harness));
    it('is selectable through the registry without call-site edits', () => checkRegistrySelection(harness));
    it('maps queue delivery into the transport vocabulary, and a rejection stays a rejection', () =>
      checkDeliveryMapping(harness));
    it('maps image attachments per its capability', () => checkImages(harness));
    it('reuses a stored session and rolls over with the next creation intent generation', () =>
      checkCreationIntent(harness));
    it('applies the requested title where naming is supported', () => checkNaming(harness));
    it('resolves on admission, not on turn completion', () => checkAdmissionOnly(harness));
    it('keeps feedback on its captured endpoint and credential', () => checkTransportSecurity(harness));
    it('resumes an admitted-but-lost feedback without a second admission', () => checkAdmissionReceipts(harness));
    it('blocks delivery without consent and delivers once consent returns', () => checkConsentTiming(harness));
  });
}
