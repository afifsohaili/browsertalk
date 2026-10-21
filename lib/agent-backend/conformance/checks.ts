import { expect } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { SERVER_URL_ERRORS } from '@/lib/connection/endpoint';
import { connectionKey } from '@/lib/connection/identity';
import { listServerProjects } from '@/lib/connection/service';
import { CONSENT_REQUIRED_ERROR, acceptConsent, declineConsent } from '@/lib/consent/consent';
import { sendQueuedItem } from '@/lib/send/send';
import { resolveStoredSession, rolloverStoredSession, type PersistSessionInput } from '@/lib/session-strategy/persist';
import { setToken } from '@/lib/storage/auth';
import { readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { bindProject } from '@/lib/storage/projects';
import { readSent } from '@/lib/storage/sent';
import { getStoredSession } from '@/lib/storage/sessions';
import { setSettings, setSessionStrategyOverride, getSettings } from '@/lib/storage/settings';
import { appendToOutbox } from '@/lib/storage/writer';
import { backendErrorCode, isProject, type FeedbackSendInput } from '../interface';
import { isSessionStrategyId } from '@/lib/session-strategy/interface';
import { hasAgentBackend, listAgentBackends } from '../registry';
import { CONFORMANCE_ENDPOINT, type ConformanceHarness } from './harness';

const DIRECTORY = '/home/afif/example';
const ORIGIN = 'https://example.com';
const ENDPOINT_B = 'http://127.0.0.1:4096';
const REMOTE_ENDPOINT = 'https://remote.example.net';
const NOW = new Date(2026, 9, 10, 12, 0);
const DAY_KEY = `${DIRECTORY}::2026-10-10`;
const DAY_TITLE = 'Browsertalk · example · 2026-10-10';
const SCREENSHOT = 'data:image/png;base64,AAAA';
const INTENT = { strategyId: 'per-day', strategyKey: DAY_KEY, generation: 0 } as const;
const RETRY_SAFE = /retrying is safe/;

function caseConnectionKey(h: ConformanceHarness, endpoint = CONFORMANCE_ENDPOINT): string {
  return connectionKey({ backendId: h.adapter.id, endpoint });
}

async function prepareSendFlow(h: ConformanceHarness): Promise<void> {
  fakeBrowser.reset();
  await setSettings({ backendId: h.adapter.id, serverUrl: CONFORMANCE_ENDPOINT });
  if (h.adapter.token !== null) await setToken(caseConnectionKey(h), h.adapter.token);
  await bindProject(caseConnectionKey(h), ORIGIN, DIRECTORY);
  await acceptConsent();
}

function elementItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 'ob_1',
    comment: 'Checkout button is broken',
    capturedAt: '2026-10-10T09:05:00.000Z',
    status: 'queued',
    facts: {
      page: {
        url: 'https://example.com/cart?step=2',
        path: '/cart',
        query: [{ name: 'step', value: '2' }],
        title: 'Cart',
      },
      elements: [
        {
          element: {
            tag: 'button',
            id: 'checkout',
            classes: ['btn'],
            selector: 'button#checkout',
            text: 'Checkout',
            attributes: { role: 'button' },
            box: { x: 10, y: 20, width: 120, height: 32 },
            viewport: { width: 1280, height: 800 },
            scroll: { x: 0, y: 0 },
          },
        },
      ],
    },
    ...overrides,
  };
}

function screenshotItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  const base = elementItem();
  const [first, ...rest] = base.facts.elements ?? [];
  return {
    ...base,
    facts: {
      ...base.facts,
      elements: [
        {
          ...first!,
          extras: { screenshot: { dataUrl: SCREENSHOT, width: 120, height: 32 } },
        },
        ...rest,
      ],
    },
    ...overrides,
  };
}

function transportSends(h: ConformanceHarness) {
  return h.transport().filter((call) => call.operation === 'send');
}

export async function checkContract(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  const backend = h.backend();

  expect(backend.id).toBe(c.id);
  expect(backend.label.length).toBeGreaterThan(0);
  expect(isSessionStrategyId(backend.defaultSessionStrategy)).toBe(true);
  expect(backend.capabilities.delivery.length).toBeGreaterThan(0);
  expect([...backend.capabilities.delivery].sort()).toEqual([...c.capabilities.delivery].sort());
  expect(backend.capabilities.projects).toBe(c.capabilities.projects);
  expect(backend.capabilities.namedCreation).toBe(c.capabilities.namedCreation);
  expect(backend.capabilities.images).toBe(c.capabilities.images);

  if (c.pairing === null) {
    expect(backend.onboarding).toBeNull();
  } else {
    const onboarding = backend.onboarding;
    expect(onboarding).not.toBeNull();
    if (onboarding !== null) {
      expect(onboarding.credentialLabel.length).toBeGreaterThan(0);
      expect(onboarding.emptyCredentialError.length).toBeGreaterThan(0);
      expect(onboarding.instructions({ endpoint: CONFORMANCE_ENDPOINT }).length).toBeGreaterThan(0);
    }
  }

  await expect(backend.ping()).resolves.toMatchObject({ ok: true });
}

export async function checkOpaqueSessionHandles(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  const backend = h.backend();

  const created = await backend.createSession({ directory: DIRECTORY, title: DAY_TITLE, intent: INTENT });
  expect(typeof created.id).toBe('string');
  expect(created.id.length).toBeGreaterThan(0);
  if (c.capabilities.namedCreation) expect(created.title).toBe(DAY_TITLE);
  expect(h.seam.creates).toEqual([{ directory: DIRECTORY, title: DAY_TITLE, intent: INTENT }]);

  const result = await backend.sendFeedback({
    sessionID: created.id,
    text: 'hello',
    delivery: 'queue',
    requestID: 'req-opaque',
  });
  expect(result.admitted).toBe(true);
  expect(h.seam.sends.at(-1)?.sessionID).toBe(created.id);

  const raw = transportSends(h);
  if (raw.length > 0) {
    expect(raw).toHaveLength(1);
    expect(raw[0]?.sessionID).toBe(created.id);
  }

  if (c.deterministicIds) {
    const reused = await backend.createSession({ directory: DIRECTORY, title: DAY_TITLE, intent: INTENT });
    expect(reused.id).toBe(created.id);

    const fresh = await backend.createSession({
      directory: DIRECTORY,
      title: DAY_TITLE,
      intent: { ...INTENT, generation: 1 },
    });
    expect(fresh.id).not.toBe(created.id);
  }
}

export async function checkProjectDiscovery(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  await prepareSendFlow(h);

  const result = await listServerProjects({ backendId: h.adapter.id, endpoint: CONFORMANCE_ENDPOINT });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.supported).toBe(c.capabilities.projects);

  if (c.capabilities.projects) {
    expect(result.projects.length).toBeGreaterThan(0);
    expect(result.projects.every(isProject)).toBe(true);
    expect(h.seam.listProjectsCalls).toBe(1);
    return;
  }

  expect(result.projects).toEqual([]);
  expect(h.seam.listProjectsCalls).toBe(0);
  expect(h.transport().some((call) => call.operation === 'list-projects')).toBe(false);

  const item = elementItem();
  await appendToOutbox(item);
  const outcome = await sendQueuedItem(item.id, { now: NOW });
  expect(outcome).toMatchObject({ ok: true });
  expect(h.seam.creates[0]?.directory).toBe(DIRECTORY);
  expect(h.seam.sends).toHaveLength(1);
}

export async function checkAuthHandling(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  const backend = h.backend();

  if (c.pairing === null) {
    expect(backend.onboarding).toBeNull();
    return;
  }

  const onboarding = backend.onboarding;
  expect(onboarding).not.toBeNull();
  if (onboarding === null) return;

  const paired = await onboarding.authenticate({ credential: c.pairing.credential });
  expect(paired.token).toBe(c.token);
  expect(h.transport().some((call) => call.operation === 'pair')).toBe(true);

  const wrong = await onboarding.authenticate({ credential: c.pairing.wrongCredential }).catch((error: unknown) => error);
  expect(backendErrorCode(wrong)).toBe('unauthorized');

  if (c.transportSecurity) {
    c.scenarios.rejectAuth?.();
    const rejecting = h.backend();
    const error = await rejecting
      .sendFeedback({ sessionID: 'ses_any', text: 'hello', delivery: 'queue', requestID: 'req-auth' })
      .catch((cause: unknown) => cause);
    expect(backendErrorCode(error)).toBe('unauthorized');
  }
}

export async function checkRegistrySelection(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  expect(hasAgentBackend(c.id)).toBe(true);
  expect(listAgentBackends()).toContain(c.id);

  fakeBrowser.reset();
  await setSessionStrategyOverride(c.id, 'sticky');
  expect((await getSettings()).sessionStrategy[c.id]).toBe('sticky');
  await setSessionStrategyOverride(c.id, null);
  expect((await getSettings()).sessionStrategy[c.id]).toBeUndefined();
}

export async function checkDeliveryMapping(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  await prepareSendFlow(h);

  const item = elementItem();
  await appendToOutbox(item);
  const first = await sendQueuedItem(item.id, { now: NOW });
  expect(first).toMatchObject({ ok: true });
  expect(h.seam.creates[0]?.intent.generation).toBe(0);

  const queueSends = transportSends(h);
  if (queueSends.length > 0) {
    expect(queueSends.map((call) => call.delivery)).toEqual([c.deliveryMapping.queue]);
  } else {
    expect(h.seam.admitted[0]?.delivery).toBe('queue');
  }

  const admittedSessionID = h.seam.admitted[0]?.sessionID ?? '';
  const steerSupported = c.capabilities.delivery.includes('steer');
  if (steerSupported) {
    const steer = await h.backend().sendFeedback({
      sessionID: admittedSessionID,
      text: 'steer this',
      delivery: 'steer',
      requestID: 'req-steer',
    });
    expect(steer.admitted).toBe(true);
    const steerSends = transportSends(h).filter((call) => call.requestID === 'req-steer');
    if (steerSends.length > 0) {
      expect(steerSends.at(-1)?.delivery).toBe(c.deliveryMapping.steer);
    } else {
      expect(h.seam.admitted.at(-1)?.delivery).toBe('steer');
    }
  }

  const second = elementItem({ id: 'ob_2', comment: 'Retry me' });
  await appendToOutbox(second);
  c.scenarios.rejectNextSend?.('busy');

  const rejected = await sendQueuedItem(second.id, { now: NOW });
  expect(rejected.ok).toBe(false);
  expect(rejected.error).toBeTruthy();
  const queued = (await readOutbox()).find((entry) => entry.id === second.id);
  expect(queued?.error).toBe(rejected.error);
  expect(queued?.admission).toBeUndefined();

  const retried = await sendQueuedItem(second.id, { now: NOW });
  expect(retried).toMatchObject({ ok: true });

  const attemptID = queued?.attempt?.requestID;
  expect(attemptID).toBeTruthy();
  const attemptSends = h.seam.sends.filter((input) => input.requestID === attemptID);
  expect(attemptSends).toHaveLength(2);
  expect(attemptSends.map((input) => input.delivery)).toEqual(['queue', 'queue']);
  const rawAttempts = transportSends(h).filter((call) => call.requestID === attemptID);
  if (rawAttempts.length > 0) {
    expect(rawAttempts).toHaveLength(2);
    expect(rawAttempts.map((call) => call.delivery)).toEqual([c.deliveryMapping.queue, c.deliveryMapping.queue]);
  }

  expect(h.seam.admitted).toHaveLength(steerSupported ? 3 : 2);
  expect((await readSent()).map((entry) => entry.id).sort()).toEqual(['ob_1', 'ob_2']);
}

export async function checkImages(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  await prepareSendFlow(h);

  const item = screenshotItem();
  await appendToOutbox(item);
  const outcome = await sendQueuedItem(item.id, { now: NOW });
  expect(outcome).toMatchObject({ ok: true });

  const admitted = h.seam.admitted[0];
  expect(admitted?.text).toContain('Checkout button is broken');
  const raw = transportSends(h);

  if (c.capabilities.images) {
    expect(admitted?.files?.map((file) => file.uri)).toEqual([SCREENSHOT]);
    if (raw.length > 0) expect(raw[0]?.attachmentURIs).toEqual([SCREENSHOT]);
  } else {
    expect(admitted?.files).toBeUndefined();
    if (raw.length > 0) expect(raw[0]?.attachmentURIs ?? []).toEqual([]);
  }
}

export async function checkCreationIntent(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  fakeBrowser.reset();

  const input: PersistSessionInput = {
    backend: h.backend(),
    connectionKey: caseConnectionKey(h),
    strategyId: 'per-day',
    strategyKey: DAY_KEY,
    directory: DIRECTORY,
    title: DAY_TITLE,
  };

  const first = await resolveStoredSession(input);
  expect(h.seam.creates).toHaveLength(1);
  expect(h.seam.creates[0]?.intent).toEqual({ strategyId: 'per-day', strategyKey: DAY_KEY, generation: 0 });

  const reused = await resolveStoredSession(input);
  expect(reused).toEqual(first);
  expect(h.seam.creates).toHaveLength(1);

  const fresh = await rolloverStoredSession(input);
  expect(fresh.id).not.toBe(first.id);
  expect(h.seam.creates).toHaveLength(2);
  expect(h.seam.creates[1]?.intent.generation).toBe(1);
  expect(await getStoredSession(input.connectionKey, 'per-day', DAY_KEY)).toEqual({
    sessionID: fresh.id,
    title: fresh.title,
    generation: 1,
  });

  const after = await resolveStoredSession(input);
  expect(after).toEqual(fresh);
  expect(h.seam.creates).toHaveLength(2);
}

export async function checkNaming(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  if (!c.capabilities.namedCreation) {
    expect(c.capabilities.namedCreation).toBe(false);
    return;
  }

  const created = await h.backend().createSession({ directory: DIRECTORY, title: DAY_TITLE, intent: INTENT });
  expect(created.title).toBe(DAY_TITLE);

  const raw = h.transport().find((call) => call.operation === 'create');
  if (raw !== undefined) expect(raw.title).toBe(DAY_TITLE);
}

export async function checkAdmissionOnly(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  await prepareSendFlow(h);

  if (c.deferTurn) {
    expect(c.scenarios.deferTurnCompletion).toBeTypeOf('function');
  } else {
    expect(c.scenarios.deferTurnCompletion).toBeUndefined();
  }
  const deferral = c.scenarios.deferTurnCompletion?.();
  const item = elementItem();
  await appendToOutbox(item);

  const outcome = await sendQueuedItem(item.id, { now: NOW });
  expect(outcome).toMatchObject({ ok: true });
  expect(h.seam.admitted).toHaveLength(1);

  if (deferral !== undefined) {
    expect(deferral.turnRunning()).toBe(true);
    deferral.release();
    expect(deferral.turnRunning()).toBe(false);
  }

  const raw = transportSends(h);
  if (raw.length > 0) expect(raw).toHaveLength(1);
}

export async function checkNullMessageID(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  if (!c.admitsWithoutMessageID) {
    expect(c.scenarios.admitWithoutMessageID).toBeUndefined();
    return;
  }
  expect(c.scenarios.admitWithoutMessageID).toBeTypeOf('function');
  await prepareSendFlow(h);

  const item = elementItem();
  await appendToOutbox(item);
  c.scenarios.admitWithoutMessageID?.();

  const outcome = await sendQueuedItem(item.id, { now: NOW });
  expect(outcome).toMatchObject({ ok: true });
  expect(await readOutbox()).toEqual([]);
  expect((await readSent()).map((entry) => entry.id)).toEqual([item.id]);

  const callsBefore = h.transport().length;
  const receipt = elementItem({
    id: 'ob_receipt_null',
    attempt: { requestID: 'req_null', sentAt: '2026-10-10T08:00:00.000Z' },
    admission: {
      requestID: 'req_null',
      messageID: null,
      sessionID: 'ses_seed',
      sessionTitle: DAY_TITLE,
      admittedAt: '2026-10-10T08:00:01.000Z',
    },
  });
  await appendToOutbox(receipt);

  const resumed = await sendQueuedItem(receipt.id, { now: NOW });
  expect(resumed).toMatchObject({ ok: true });
  expect(h.transport()).toHaveLength(callsBefore);
  expect(h.seam.sends.map((input) => input.requestID)).not.toContain('req_null');
  expect(await readSent()).toHaveLength(2);
}

export async function checkConflictingRequestReuse(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  if (!c.rejectsConflictingReuse) return;
  await prepareSendFlow(h);

  const item = c.capabilities.images ? screenshotItem() : elementItem();
  await appendToOutbox(item);
  const first = await sendQueuedItem(item.id, { now: NOW });
  expect(first).toMatchObject({ ok: true });

  const admitted = h.seam.admitted[0];
  expect(admitted).toBeDefined();
  const base: FeedbackSendInput = {
    sessionID: admitted?.sessionID ?? '',
    text: admitted?.text ?? '',
    delivery: 'queue',
    requestID: admitted?.requestID ?? '',
    ...(admitted?.files === undefined ? {} : { files: admitted.files }),
  };

  const otherSession = await h.backend().createSession({
    directory: DIRECTORY,
    title: DAY_TITLE,
    intent: { ...INTENT, generation: 1 },
  });

  const conflicts: FeedbackSendInput[] = [
    { ...base, text: `${base.text}\n\n(conflicting reuse)` },
    { ...base, sessionID: otherSession.id },
  ];
  if (c.capabilities.delivery.includes('steer')) conflicts.push({ ...base, delivery: 'steer' });
  if (c.capabilities.images) {
    const files = base.files ?? [];
    expect(files).toHaveLength(1);
    const file = files[0];
    if (file !== undefined) {
      conflicts.push(
        { ...base, files: [{ ...file, uri: `${SCREENSHOT}A` }] },
        { ...base, files: [{ ...file, name: 'renamed.png' }] },
        { ...base, files: [{ ...file, description: 'A different attachment description' }] },
      );
    }
  }

  for (const conflicting of conflicts) {
    const error = await h.backend().sendFeedback(conflicting).catch((cause: unknown) => cause);
    expect(backendErrorCode(error)).not.toBeNull();
    expect(c.admissions()).toBe(1);
    expect(await readSent()).toHaveLength(1);
  }

  const replay = await h.backend().sendFeedback(base);
  expect(replay.admitted).toBe(true);
  expect(c.admissions()).toBe(1);
  expect(await readSent()).toHaveLength(1);
}

export async function checkTransportSecurity(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  if (!c.transportSecurity) {
    expect(c.credentialHeader).toBeNull();
    return;
  }

  const remote = h.backend({ baseUrl: REMOTE_ENDPOINT, token: c.token });
  await expect(remote.createSession({ directory: DIRECTORY, title: DAY_TITLE, intent: INTENT })).rejects.toThrow(
    SERVER_URL_ERRORS.remote,
  );
  expect(h.transport()).toHaveLength(0);

  await prepareSendFlow(h);
  const item = elementItem({
    destination: { backendId: c.id, endpoint: CONFORMANCE_ENDPOINT, directory: DIRECTORY },
  });
  await appendToOutbox(item);
  await setSettings({ serverUrl: ENDPOINT_B });
  await setToken(caseConnectionKey(h, ENDPOINT_B), 'tok_other');

  const outcome = await sendQueuedItem(item.id, { now: NOW });
  expect(outcome).toMatchObject({ ok: true });

  const raw = h.transport();
  expect(raw.length).toBeGreaterThan(0);
  expect(raw.every((call) => call.endpoint === CONFORMANCE_ENDPOINT)).toBe(true);
  if (c.credentialHeader !== null && c.token !== null) {
    const expected = c.credentialHeader(c.token);
    expect(raw.map((call) => call.credential)).toEqual(raw.map(() => expected));
  }
  expect(raw.every((call) => call.redirect === 'error')).toBe(true);
}

export async function checkAdmissionReceipts(h: ConformanceHarness): Promise<void> {
  const c = h.adapter;
  await prepareSendFlow(h);

  const item = elementItem();
  await appendToOutbox(item);
  c.scenarios.loseNextAdmissionReceipt?.();

  const lost = await sendQueuedItem(item.id, { now: NOW });
  expect(lost.ok).toBe(false);
  expect(lost.error ?? '').toMatch(RETRY_SAFE);

  const failed = (await readOutbox())[0];
  expect(failed?.attempt?.requestID).toEqual(expect.any(String));
  expect(failed?.admission).toBeUndefined();
  const requestID = failed?.attempt?.requestID ?? '';

  const resumed = await sendQueuedItem(item.id, { now: NOW });
  expect(resumed).toMatchObject({ ok: true });

  expect(h.seam.sends.map((input) => input.requestID)).toEqual([requestID, requestID]);
  const raw = transportSends(h);
  if (raw.length > 0) {
    expect(raw).toHaveLength(2);
    expect(raw.map((call) => call.requestID)).toEqual([requestID, requestID]);
    expect(raw.filter((call) => call.admitted === true)).toHaveLength(1);
  }

  expect(c.admissions()).toBe(1);
  expect(await readOutbox()).toEqual([]);
  expect(await readSent()).toHaveLength(1);

  const callsBefore = h.transport().length;
  const receipt = elementItem({
    id: 'ob_receipt',
    attempt: { requestID: 'req_seed', sentAt: '2026-10-10T08:00:00.000Z' },
    admission: {
      requestID: 'req_seed',
      messageID: 'msg_seed',
      sessionID: 'ses_seed',
      sessionTitle: DAY_TITLE,
      admittedAt: '2026-10-10T08:00:01.000Z',
    },
  });
  await appendToOutbox(receipt);

  const resumedFromReceipt = await sendQueuedItem(receipt.id, { now: NOW });
  expect(resumedFromReceipt).toMatchObject({ ok: true });
  expect(h.transport()).toHaveLength(callsBefore);
  expect(h.seam.sends.map((input) => input.requestID)).not.toContain('req_seed');
  expect(await readSent()).toHaveLength(2);
}

export async function checkConsentTiming(h: ConformanceHarness): Promise<void> {
  await prepareSendFlow(h);

  const item = elementItem();
  await appendToOutbox(item);
  await declineConsent();

  const blocked = await sendQueuedItem(item.id, { now: NOW });
  expect(blocked).toEqual({ ok: false, error: CONSENT_REQUIRED_ERROR });
  expect(h.seam.creates).toHaveLength(0);
  expect(h.seam.sends).toHaveLength(0);
  expect(h.transport()).toHaveLength(0);
  expect((await readOutbox())[0]?.error).toBe(CONSENT_REQUIRED_ERROR);

  await acceptConsent();
  const delivered = await sendQueuedItem(item.id, { now: NOW });
  expect(delivered).toMatchObject({ ok: true });
  expect(await readSent()).toHaveLength(1);
}
