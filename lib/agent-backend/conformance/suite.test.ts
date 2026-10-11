import { describe, expect, it } from 'vitest';
import { FakeAgentBackend } from '../fake';
import { BackendError } from '../interface';
import type {
  BackendCapabilities,
  FeedbackSendInput,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from '../interface';
import { registerAgentBackend } from '../registry';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy/builtins';
import { listSessionStrategies } from '@/lib/session-strategy/registry';
import { fakeConformanceCases, openCodeConformanceCase, piConformanceCase } from './cases';
import {
  checkAdmissionOnly,
  checkConflictingRequestReuse,
  checkContract,
  checkOpaqueSessionHandles,
} from './checks';
import { ConformanceHarness } from './harness';
import { describeAdapterConformance } from './suite';
import type { AdapterConformanceCase } from './types';

for (const adapter of fakeConformanceCases()) describeAdapterConformance(adapter);
describeAdapterConformance(openCodeConformanceCase());
describeAdapterConformance(piConformanceCase());

class PrefixOnlyBackend extends FakeAgentBackend {
  override async createSession(input: SessionCreateInput): Promise<SessionRef> {
    return { id: crypto.randomUUID(), title: input.title };
  }

  override async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    if (!input.sessionID.startsWith('ses_')) throw new Error('The session handle is malformed');
    return super.sendFeedback(input);
  }
}

class UnnamedBackend extends FakeAgentBackend {
  override readonly capabilities: BackendCapabilities = {
    projects: true,
    namedCreation: false,
    delivery: ['queue'],
    images: true,
  };
}

class TextOnlyDedupBackend extends FakeAgentBackend {
  private readonly fingerprints = new Map<string, string>();

  override async sendFeedback(input: FeedbackSendInput): Promise<SendResult> {
    const fingerprint = `${input.sessionID}\u0000${input.text}`;
    const previous = this.fingerprints.get(input.requestID);
    if (previous !== undefined && previous !== fingerprint) {
      throw new BackendError('busy', 'This request id was already admitted with different content');
    }
    this.fingerprints.set(input.requestID, fingerprint);
    return super.sendFeedback(input);
  }
}

const BROKEN_CAPABILITIES: BackendCapabilities = {
  projects: true,
  namedCreation: true,
  delivery: ['queue', 'steer'],
  images: true,
};

function brokenCase(
  id: string,
  create: () => FakeAgentBackend,
  capabilities: BackendCapabilities,
  overrides: Partial<AdapterConformanceCase> = {},
): AdapterConformanceCase {
  let adapter = create();
  return {
    id,
    label: id,
    capabilities,
    deterministicIds: false,
    transportSecurity: false,
    deferTurn: false,
    admitsWithoutMessageID: false,
    rejectsConflictingReuse: false,
    deliveryMapping: { queue: 'queue', steer: 'steer' },
    token: null,
    pairing: null,
    credentialHeader: null,
    create: () => adapter,
    transport: () => [],
    admissions: () => 1,
    reset: () => {
      adapter = create();
    },
    scenarios: {},
    ...overrides,
  };
}

describe('conformance suite teeth', () => {
  it('fails an adapter that cannot accept its own session handle', async () => {
    const harness = new ConformanceHarness(brokenCase('broken-handles', () => new PrefixOnlyBackend(), BROKEN_CAPABILITIES));
    harness.reset();

    await expect(checkOpaqueSessionHandles(harness)).rejects.toThrow('The session handle is malformed');
  });

  it('fails an adapter whose declared capabilities lie', async () => {
    const harness = new ConformanceHarness(brokenCase('broken-naming', () => new UnnamedBackend(), BROKEN_CAPABILITIES));
    harness.reset();

    await expect(checkContract(harness)).rejects.toThrow();
  });

  it('fails a case that claims a deferrable turn without a scenario', async () => {
    const harness = new ConformanceHarness(
      brokenCase('missing-deferral', () => new FakeAgentBackend(), BROKEN_CAPABILITIES, { deferTurn: true }),
    );
    harness.reset();

    await expect(checkAdmissionOnly(harness)).rejects.toThrow();
  });

  it('fails an adapter that silently admits a conflicting request id reuse', async () => {
    const backend = new FakeAgentBackend();
    const harness = new ConformanceHarness(
      brokenCase('silent-dedup', () => backend, BROKEN_CAPABILITIES, {
        rejectsConflictingReuse: true,
        admissions: () => backend.feedbackCalls.length,
      }),
    );
    if (listSessionStrategies().length === 0) registerBuiltinSessionStrategies();
    registerAgentBackend('silent-dedup', () => backend);
    harness.reset();

    await expect(checkConflictingRequestReuse(harness)).rejects.toThrow();
  });

  it('fails an adapter that compares only the text of a reused request id', async () => {
    const backend = new TextOnlyDedupBackend();
    const harness = new ConformanceHarness(
      brokenCase('text-only-dedup', () => backend, BROKEN_CAPABILITIES, {
        rejectsConflictingReuse: true,
        admissions: () => backend.feedbackCalls.length,
      }),
    );
    if (listSessionStrategies().length === 0) registerBuiltinSessionStrategies();
    registerAgentBackend('text-only-dedup', (config) => harness.backend(config));
    harness.reset();

    await expect(checkConflictingRequestReuse(harness)).rejects.toThrow();
  });
});
