export const STORAGE_KEYS = {
  settings: {
    backendId: 'settings.backendId',
    serverUrl: 'settings.serverUrl',
    sessionStrategy: 'settings.sessionStrategy',
  },
  auth: {
    token: 'auth.token',
    tokens: 'auth.tokens',
  },
  consent: {
    status: 'consent.status',
  },
  projects: {
    byOrigin: 'projects.byOrigin',
  },
  sessions: 'sessions',
  migration: {
    owner: 'migration.owner',
  },
  pending: {
    feedback: 'pending.feedback',
  },
  outbox: 'outbox',
  sent: 'sent',
} as const;
