import type { BackendStatus, Project } from '@/lib/agent-backend/interface';
import { redeemPairingCode } from '@/lib/agent-backend/opencode-api';
import { connectionKey } from '@/lib/connection/identity';
import { connectionBackend, resolveConfiguredConnection } from '@/lib/connection/resolve';
import { setToken } from '@/lib/storage/auth';
import { bindProject } from '@/lib/storage/projects';
import type { ConnectionResult, ProjectsResult } from './protocol';

export async function pairWithServer(code: string): Promise<ConnectionResult> {
  const trimmed = code.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Enter a pairing code' };

  const resolved = await resolveConfiguredConnection();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  try {
    const token = await redeemPairingCode({ baseUrl: resolved.connection.endpoint, code: trimmed });
    await setToken(connectionKey(resolved.connection), token);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function pingConnection(): Promise<BackendStatus> {
  try {
    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) return { ok: false, detail: resolved.error };
    return await connectionBackend(resolved.connection).ping();
  } catch (error) {
    return { ok: false, detail: describeError(error) };
  }
}

export async function listServerProjects(): Promise<ProjectsResult> {
  try {
    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const projects: Project[] = await connectionBackend(resolved.connection).listProjects();
    return { ok: true, projects };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export interface BindOriginInput {
  origin: string;
  projectDirectory: string;
}

export async function bindOrigin(input: BindOriginInput): Promise<ConnectionResult> {
  const origin = normalizeOrigin(input.origin);
  if (origin === null) return { ok: false, error: 'That page has no bindable origin' };

  const projectDirectory = input.projectDirectory.trim();
  if (projectDirectory.length === 0) return { ok: false, error: 'Pick a project first' };

  const resolved = await resolveConfiguredConnection();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  await bindProject(connectionKey(resolved.connection), origin, projectDirectory);
  return { ok: true };
}

function normalizeOrigin(value: string): string | null {
  try {
    const origin = new URL(value).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
