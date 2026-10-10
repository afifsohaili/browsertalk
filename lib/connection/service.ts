import type { BackendStatus, Project } from '@/lib/agent-backend/interface';
import { redeemPairingCode } from '@/lib/agent-backend/opencode-api';
import { getAgentBackend } from '@/lib/agent-backend/registry';
import { setToken } from '@/lib/storage/auth';
import { bindProject } from '@/lib/storage/projects';
import { getSettings } from '@/lib/storage/settings';
import type { ConnectionResult, ProjectsResult } from './protocol';

export async function pairWithServer(code: string): Promise<ConnectionResult> {
  const trimmed = code.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Enter a pairing code' };

  const { serverUrl } = await getSettings();
  try {
    const token = await redeemPairingCode({ baseUrl: serverUrl, code: trimmed });
    await setToken(token);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function pingConnection(): Promise<BackendStatus> {
  try {
    const { backendId } = await getSettings();
    return await getAgentBackend(backendId).ping();
  } catch (error) {
    return { ok: false, detail: describeError(error) };
  }
}

export async function listServerProjects(): Promise<ProjectsResult> {
  try {
    const { backendId } = await getSettings();
    const projects: Project[] = await getAgentBackend(backendId).listProjects();
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

  await bindProject(origin, projectDirectory);
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
