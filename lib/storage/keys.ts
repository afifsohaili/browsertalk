export const STORAGE_KEYS = {
  settings: {
    backendId: 'settings.backendId',
    serverUrl: 'settings.serverUrl',
    sessionStrategy: 'settings.sessionStrategy',
  },
  auth: {
    token: 'auth.token',
  },
  projects: {
    byOrigin: 'projects.byOrigin',
  },
  sessions: 'sessions',
  pending: {
    feedback: 'pending.feedback',
  },
  outbox: 'outbox',
} as const;
