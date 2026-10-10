import { describe, expect, it } from 'vitest';
import { isConnectionIdentity, isConnectionRequest, isProjectsResult } from './protocol';

const CONNECTION = { backendId: 'opencode', endpoint: 'http://127.0.0.1:15001' };

describe('connection request guard', () => {
  it('accepts the request shapes with their required fields', () => {
    expect(isConnectionRequest({ type: 'connection/status' })).toBe(true);
    expect(isConnectionRequest({ type: 'connection/onboarding' })).toBe(true);
    expect(isConnectionRequest({ type: 'connection/projects', connection: CONNECTION })).toBe(true);
    expect(isConnectionRequest({ type: 'connection/pair', code: 'ABC123' })).toBe(true);
    expect(
      isConnectionRequest({
        type: 'connection/bind',
        origin: 'https://example.com',
        projectDirectory: '/home/afif/example',
        connection: CONNECTION,
      }),
    ).toBe(true);
  });

  it('rejects requests missing their required fields', () => {
    expect(isConnectionRequest({ type: 'connection/pair' })).toBe(false);
    expect(isConnectionRequest({ type: 'connection/pair', code: '' })).toBe(false);
    expect(isConnectionRequest({ type: 'connection/pair', code: 42 })).toBe(false);
    expect(isConnectionRequest({ type: 'connection/projects' })).toBe(false);
    expect(isConnectionRequest({ type: 'connection/bind' })).toBe(false);
    expect(isConnectionRequest({ type: 'connection/bind', origin: 'https://example.com' })).toBe(false);
    expect(isConnectionRequest({ type: 'connection/bind', origin: 42, projectDirectory: '/dir' })).toBe(false);
    expect(
      isConnectionRequest({
        type: 'connection/bind',
        origin: 'https://example.com',
        projectDirectory: '/home/afif/example',
      }),
    ).toBe(false);
  });

  it('leaves other messages alone', () => {
    expect(isConnectionRequest({ type: 'connection/changed' })).toBe(false);
    expect(isConnectionRequest({ type: 'picker/arm' })).toBe(false);
    expect(isConnectionRequest('connection/status')).toBe(false);
    expect(isConnectionRequest(null)).toBe(false);
  });
});

describe('connection identity guard', () => {
  it('accepts a known-shaped backend with a canonical loopback endpoint', () => {
    expect(isConnectionIdentity(CONNECTION)).toBe(true);
    expect(isConnectionIdentity({ backendId: 'pi', endpoint: 'http://localhost:4096' })).toBe(true);
  });

  it('rejects remote, non-canonical, or malformed identities', () => {
    expect(isConnectionIdentity({ backendId: 'opencode', endpoint: 'https://example.com' })).toBe(false);
    expect(isConnectionIdentity({ backendId: 'opencode', endpoint: 'http://127.0.0.1:15001/' })).toBe(false);
    expect(isConnectionIdentity({ backendId: '', endpoint: 'http://127.0.0.1:15001' })).toBe(false);
    expect(isConnectionIdentity({ endpoint: 'http://127.0.0.1:15001' })).toBe(false);
    expect(isConnectionIdentity({ backendId: 'opencode' })).toBe(false);
    expect(isConnectionIdentity(null)).toBe(false);
  });
});

describe('projects result guard', () => {
  it('accepts a member-checked project list', () => {
    expect(
      isProjectsResult({ ok: true, supported: true, projects: [{ id: 'p1', name: 'x', directory: '/home/afif/x' }] }),
    ).toBe(true);
    expect(isProjectsResult({ ok: true, supported: false, projects: [] })).toBe(true);
    expect(isProjectsResult({ ok: false, error: 'Not paired' })).toBe(true);
  });

  it('rejects a project list with broken members', () => {
    expect(isProjectsResult({ ok: true, supported: true, projects: [{ id: 'p1' }] })).toBe(false);
    expect(isProjectsResult({ ok: true, supported: true, projects: [{ id: '', name: 'x', directory: '/x' }] })).toBe(false);
    expect(isProjectsResult({ ok: true, supported: true, projects: [{ id: 'p1', name: 7, directory: '/x' }] })).toBe(false);
    expect(isProjectsResult({ ok: true, supported: true, projects: ['p1'] })).toBe(false);
    expect(isProjectsResult({ ok: true, projects: [] })).toBe(false);
    expect(isProjectsResult({ ok: false })).toBe(false);
  });
});
