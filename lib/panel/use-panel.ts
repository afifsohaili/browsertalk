import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue';
import { browser } from 'wxt/browser';
import type { Project, SessionRef } from '@/lib/agent-backend/interface';
import { onOutboxChanged } from '@/lib/composer/messages';
import { requestBind, requestProjects } from '@/lib/connection/messages';
import { sameConnection, type ConnectionIdentity } from '@/lib/connection/identity';
import { STORAGE_KEYS } from '@/lib/storage/keys';
import { readOutbox, type OutboxItem } from '@/lib/storage/outbox';
import { readSent, type SentItem } from '@/lib/storage/sent';
import {
  requestOutboxDiscard,
  requestOutboxRetry,
  requestSessionChoose,
  requestSessionRollover,
  requestSessions,
  requestTargetRead,
} from './messages';

const NO_PAGE_TO_TARGET = 'No page to target';
const NO_PROJECT_TO_TARGET = 'This site has no project binding';

export interface PanelTarget {
  origin: string | null;
  project: string | null;
  session: SessionRef | null;
}

export type TargetState = 'unavailable' | 'no-page' | 'unbound' | 'no-session' | 'ready';

export function targetState(target: PanelTarget | null): TargetState {
  if (target === null) return 'unavailable';
  if (target.origin === null) return 'no-page';
  if (target.project === null) return 'unbound';
  if (target.session === null) return 'no-session';
  return 'ready';
}

export function formatTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (date.toDateString() === now.toDateString()) return time;
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
}

export function elementCountLabel(count: number | undefined): string {
  if (count === undefined || count <= 0) return '';
  return `${count} ${count === 1 ? 'element' : 'elements'}`;
}

export function outboxMeta(item: OutboxItem, now: Date = new Date()): string {
  return metaLine([
    elementCountLabel(item.facts.elements?.length),
    formatTimestamp(item.capturedAt, now),
    item.facts.page.title || item.facts.page.url,
  ]);
}

export function sentMeta(entry: SentItem, now: Date = new Date()): string {
  return metaLine([elementCountLabel(entry.elementCount), formatTimestamp(entry.sentAt, now), entry.session.title]);
}

function metaLine(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(' · ');
}

export interface Panel {
  loaded: Ref<boolean>;
  target: Ref<PanelTarget | null>;
  outbox: Ref<OutboxItem[]>;
  sent: Ref<SentItem[]>;
  retrying: Ref<string | null>;
  rollingOver: Ref<boolean>;
  error: Ref<string | null>;
  projectsOpen: Ref<boolean>;
  projectsLoading: Ref<boolean>;
  projectsSupported: Ref<boolean>;
  projects: Ref<Project[]>;
  projectsError: Ref<string | null>;
  binding: Ref<boolean>;
  sessionsOpen: Ref<boolean>;
  sessionsLoading: Ref<boolean>;
  sessionsSupported: Ref<boolean>;
  sessions: Ref<SessionRef[]>;
  sessionsError: Ref<string | null>;
  adopting: Ref<boolean>;
  refresh: () => Promise<void>;
  retry: (itemId: string) => Promise<void>;
  discard: (itemId: string) => Promise<void>;
  newSession: () => Promise<void>;
  openProjects: () => Promise<void>;
  closeProjects: () => void;
  chooseProject: (directory: string) => Promise<void>;
  openSessions: () => Promise<void>;
  closeSessions: () => void;
  chooseSession: (session: SessionRef) => Promise<void>;
}

export function usePanel(): Panel {
  const loaded = ref(false);
  const target = ref<PanelTarget | null>(null);
  const outbox = ref<OutboxItem[]>([]);
  const sent = ref<SentItem[]>([]);
  const retrying = ref<string | null>(null);
  const rollingOver = ref(false);
  const error = ref<string | null>(null);
  const projectsOpen = ref(false);
  const projectsLoading = ref(false);
  const projectsSupported = ref(true);
  const projects = ref<Project[]>([]);
  const projectsError = ref<string | null>(null);
  const binding = ref(false);
  const sessionsOpen = ref(false);
  const sessionsLoading = ref(false);
  const sessionsSupported = ref(true);
  const sessions = ref<SessionRef[]>([]);
  const sessionsError = ref<string | null>(null);
  const adopting = ref(false);
  let projectsOrigin: string | null = null;
  let projectsConnection: ConnectionIdentity | null = null;
  let sessionsOrigin: string | null = null;
  let sessionsConnection: ConnectionIdentity | null = null;
  let targetConnection: ConnectionIdentity | null = null;
  let targetGeneration = 0;
  let projectsGeneration = 0;
  let sessionsGeneration = 0;
  let refreshPromise: Promise<void> | null = null;

  async function run(action: () => Promise<void>): Promise<void> {
    error.value = null;
    try {
      await action();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function refreshTarget(): Promise<void> {
    const generation = ++targetGeneration;
    const origin = await activeOrigin();
    if (generation !== targetGeneration) return;

    if (origin === null) {
      closeProjects();
      closeSessions();
      target.value = { origin: null, project: null, session: null };
      return;
    }
    if (projectsOpen.value && projectsOrigin !== origin) closeProjects();
    if (sessionsOpen.value && sessionsOrigin !== origin) closeSessions();

    const result = await requestTargetRead(origin);
    if (generation !== targetGeneration) return;

    if (!result.ok) {
      target.value = null;
      throw new Error(result.error);
    }
    if (projectsOpen.value && (projectsConnection === null || !sameConnection(projectsConnection, result.connection))) {
      closeProjects();
    }
    if (sessionsOpen.value && (sessionsConnection === null || !sameConnection(sessionsConnection, result.connection))) {
      closeSessions();
    }
    targetConnection = result.connection;
    target.value = { origin, project: result.target.project, session: result.target.session };
  }

  async function refreshLists(): Promise<void> {
    const [items, history] = await Promise.all([readOutbox(), readSent()]);
    outbox.value = items;
    sent.value = history;
  }

  function refresh(): Promise<void> {
    return (async () => {
      await run(async () => {
        await Promise.all([refreshTarget(), refreshLists()]);
      });
      loaded.value = true;
    })();
  }

  async function retry(itemId: string): Promise<void> {
    retrying.value = itemId;
    await run(async () => {
      const result = await requestOutboxRetry(itemId);
      await refreshLists();
      if (!result.ok && !outbox.value.some((item) => item.id === itemId && item.error === result.error)) {
        error.value = result.error;
      }
    });
    retrying.value = null;
  }

  async function discard(itemId: string): Promise<void> {
    await run(async () => {
      const result = await requestOutboxDiscard(itemId);
      await refreshLists();
      if (!result.ok) error.value = result.error;
    });
  }

  async function newSession(): Promise<void> {
    rollingOver.value = true;
    await run(async () => {
      await waitForRefreshedTarget();
      const current = target.value;
      const connection = targetConnection;
      if (current === null || current.origin === null || connection === null) {
        error.value = NO_PAGE_TO_TARGET;
        return;
      }
      const { origin, project } = current;

      const result = await requestSessionRollover(origin, connection);
      if (target.value?.origin !== origin || targetConnection === null || !sameConnection(targetConnection, connection)) {
        return;
      }
      if (!result.ok) {
        error.value = result.error;
        return;
      }
      target.value = { origin, project, session: result.session };
      closeSessions();
    });
    rollingOver.value = false;
  }

  function closeProjects(): void {
    projectsOpen.value = false;
    projectsOrigin = null;
    projectsConnection = null;
    projectsLoading.value = false;
    projectsError.value = null;
    projectsGeneration += 1;
  }

  async function openProjects(): Promise<void> {
    await waitForRefreshedTarget();
    const current = target.value;
    const connection = targetConnection;
    if (current === null || current.origin === null || connection === null) {
      error.value = NO_PAGE_TO_TARGET;
      return;
    }
    closeSessions();
    const origin = current.origin;
    projectsOrigin = origin;
    projectsConnection = connection;
    const generation = ++projectsGeneration;

    projectsOpen.value = true;
    projectsLoading.value = true;
    projectsError.value = null;

    const result = await requestProjects(connection);
    if (generation !== projectsGeneration || projectsOrigin !== origin) return;

    projectsLoading.value = false;
    if (!result.ok) {
      projects.value = [];
      projectsError.value = result.error;
      return;
    }
    projectsSupported.value = result.supported;
    projects.value = result.projects;
  }

  async function chooseProject(directory: string): Promise<void> {
    const origin = projectsOrigin;
    const connection = projectsConnection;
    if (origin === null || connection === null) {
      error.value = NO_PAGE_TO_TARGET;
      return;
    }

    binding.value = true;
    const result = await requestBind(origin, directory, connection);
    binding.value = false;
    if (!result.ok) {
      projectsError.value = result.error;
      return;
    }

    closeProjects();
    await run(refreshTarget);
  }

  function closeSessions(): void {
    sessionsOpen.value = false;
    sessionsOrigin = null;
    sessionsConnection = null;
    sessionsLoading.value = false;
    sessionsError.value = null;
    sessionsGeneration += 1;
  }

  async function openSessions(): Promise<void> {
    await waitForRefreshedTarget();
    const current = target.value;
    const connection = targetConnection;
    if (current === null || current.origin === null || connection === null) {
      error.value = NO_PAGE_TO_TARGET;
      return;
    }
    if (current.project === null) {
      error.value = NO_PROJECT_TO_TARGET;
      return;
    }
    closeProjects();
    const origin = current.origin;
    sessionsOrigin = origin;
    sessionsConnection = connection;
    const generation = ++sessionsGeneration;

    sessionsOpen.value = true;
    sessionsLoading.value = true;
    sessionsError.value = null;

    const result = await requestSessions(origin, connection);
    if (generation !== sessionsGeneration || sessionsOrigin !== origin) return;

    sessionsLoading.value = false;
    if (!result.ok) {
      sessions.value = [];
      sessionsError.value = result.error;
      return;
    }
    sessionsSupported.value = result.supported;
    sessions.value = result.sessions;
  }

  async function chooseSession(session: SessionRef): Promise<void> {
    const origin = sessionsOrigin;
    const connection = sessionsConnection;
    if (origin === null || connection === null) {
      error.value = NO_PAGE_TO_TARGET;
      return;
    }

    adopting.value = true;
    const result = await requestSessionChoose(origin, connection, session);
    adopting.value = false;
    if (!result.ok) {
      sessionsError.value = result.error;
      return;
    }

    closeSessions();
    await run(refreshTarget);
  }

  function reloadTarget(): void {
    refreshPromise = run(refreshTarget);
    void refreshPromise;
  }

  async function waitForRefreshedTarget(): Promise<void> {
    while (targetConnection === null && refreshPromise !== null) {
      const pending = refreshPromise;
      await pending;
      if (refreshPromise === pending) return;
    }
  }

  function invalidateTarget(): void {
    targetGeneration += 1;
    target.value = null;
    targetConnection = null;
    closeProjects();
    closeSessions();
  }

  function reloadLists(): void {
    void run(refreshLists);
  }

  function onStorageChanged(changes: Record<string, unknown>): void {
    const keys = Object.keys(changes);
    const connectionChanged =
      keys.includes(STORAGE_KEYS.settings.backendId) || keys.includes(STORAGE_KEYS.settings.serverUrl);
    if (connectionChanged) {
      invalidateTarget();
      reloadTarget();
    } else if (
      keys.includes(STORAGE_KEYS.sessions) ||
      keys.includes(STORAGE_KEYS.projects.byOrigin) ||
      keys.includes(STORAGE_KEYS.settings.sessionStrategy)
    ) {
      reloadTarget();
    }
    if (keys.includes(STORAGE_KEYS.outbox) || keys.includes(STORAGE_KEYS.sent)) reloadLists();
  }

  function onTabUpdated(_tabId: number, changeInfo: { url?: string }): void {
    if (changeInfo.url !== undefined) reloadTarget();
  }

  const stopOutbox = onOutboxChanged(reloadLists);
  browser.tabs.onActivated.addListener(reloadTarget);
  browser.tabs.onUpdated.addListener(onTabUpdated);
  browser.storage.local.onChanged.addListener(onStorageChanged);

  function stop(): void {
    stopOutbox();
    browser.tabs.onActivated.removeListener(reloadTarget);
    browser.tabs.onUpdated.removeListener(onTabUpdated);
    browser.storage.local.onChanged.removeListener(onStorageChanged);
  }
  if (getCurrentScope()) onScopeDispose(stop);

  void refresh();

  return {
    loaded,
    target,
    outbox,
    sent,
    retrying,
    rollingOver,
    error,
    projectsOpen,
    projectsLoading,
    projectsSupported,
    projects,
    projectsError,
    binding,
    sessionsOpen,
    sessionsLoading,
    sessionsSupported,
    sessions,
    sessionsError,
    adopting,
    refresh,
    retry,
    discard,
    newSession,
    openProjects,
    closeProjects,
    chooseProject,
    openSessions,
    closeSessions,
    chooseSession,
  };
}

async function activeOrigin(): Promise<string | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  if (typeof url !== 'string' || url.length === 0) return null;

  try {
    const origin = new URL(url).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
