import { describe, expect, it } from 'vitest';
import { FakeAgentBackend } from '../fake';
import type {
  BackendCapabilities,
  FeedbackSendInput,
  SendResult,
  SessionCreateInput,
  SessionRef,
} from '../interface';
import { fakeConformanceCases, openCodeConformanceCase, piConformanceCase } from './cases';
import { checkContract, checkOpaqueSessionHandles } from './checks';
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
): AdapterConformanceCase {
  let adapter = create();
  return {
    id,
    label: id,
    capabilities,
    deterministicIds: false,
    transportSecurity: false,
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
});
