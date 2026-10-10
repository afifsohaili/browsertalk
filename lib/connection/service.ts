import { isProject, type BackendStatus, type Project } from '@/lib/agent-backend/interface';
import { connectionKey } from '@/lib/connection/identity';
import { connectionBackend, resolveConfiguredConnection } from '@/lib/connection/resolve';
import { setToken } from '@/lib/storage/auth';
import { bindProject } from '@/lib/storage/projects';
import type { ConnectionResult, OnboardingResult, ProjectsResult } from './protocol';

export async function pairWithServer(credential: string): Promise<ConnectionResult> {
  const resolved = await resolveConfiguredConnection();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const onboarding = connectionBackend(resolved.connection).onboarding;
  if (onboarding === null) return { ok: false, error: 'This backend needs no pairing' };

  const trimmed = credential.trim();
  if (trimmed.length === 0) return { ok: false, error: onboarding.emptyCredentialError };

  try {
    const { token } = await onboarding.authenticate({ credential: trimmed });
    if (token !== null) await setToken(connectionKey(resolved.connection), token);
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

export async function connectionOnboarding(): Promise<OnboardingResult> {
  try {
    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) return { ok: false, error: resolved.error };

    const onboarding = connectionBackend(resolved.connection).onboarding;
    if (onboarding === null) return { ok: true, onboarding: null };

    const input = { endpoint: resolved.connection.endpoint };
    return {
      ok: true,
      onboarding: {
        instructions: onboarding.instructions(input),
        command: onboarding.command(input),
        credentialLabel: onboarding.credentialLabel,
      },
    };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function listServerProjects(): Promise<ProjectsResult> {
  try {
    const resolved = await resolveConfiguredConnection();
    if (!resolved.ok) return { ok: false, error: resolved.error };

    const backend = connectionBackend(resolved.connection);
    if (!backend.capabilities.projects) return { ok: true, supported: false, projects: [] };

    const projects: Project[] = await backend.listProjects();
    if (!projects.every(isProject)) {
      return { ok: false, error: 'The server sent a project list we could not read' };
    }
    return { ok: true, supported: true, projects };
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
