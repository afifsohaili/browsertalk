<script lang="ts" setup>
import { computed } from 'vue';
import ArmPickerButton from '@/components/ArmPickerButton.vue';
import CommentOnPageButton from '@/components/CommentOnPageButton.vue';
import ConsentGate from '@/components/ConsentGate.vue';
import ConnectionPanel from '@/components/ConnectionPanel.vue';
import SettingsLink from '@/components/SettingsLink.vue';
import { useConsent } from '@/lib/consent/use-consent';
import { formatTimestamp, targetState, usePanel } from '@/lib/panel/use-panel';
import { projectName } from '@/lib/session-strategy/interface';

const {
  loaded: consentLoaded,
  status: consentStatus,
  accepted: consentAccepted,
  accept: acceptConsent,
  decline: declineConsent,
} = useConsent();

const {
  loaded,
  target,
  outbox,
  sent,
  retrying,
  rollingOver,
  error,
  retry,
  discard,
  newSession,
  projectsOpen,
  projectsLoading,
  projects,
  projectsError,
  binding,
  openProjects,
  closeProjects,
  chooseProject,
} = usePanel();

const state = computed(() => targetState(target.value));

const bound = computed(() => state.value === 'no-session' || state.value === 'ready');

const projectText = computed(() => {
  switch (state.value) {
    case 'unavailable':
      return '—';
    case 'no-page':
      return 'No page';
    case 'unbound':
      return 'No project bound';
    default:
      return projectName(target.value?.project ?? '');
  }
});

const sessionText = computed(() => {
  const current = target.value;
  if (current === null || current.project === null) return '—';
  return current.session?.title ?? 'No session yet';
});
</script>

<template>
  <ConsentGate
    v-if="consentLoaded && !consentAccepted"
    :status="consentStatus"
    @accept="acceptConsent"
    @decline="declineConsent"
  />
  <main v-else-if="consentLoaded" class="panel">
    <header>
      <h1>Browsertalk</h1>
      <SettingsLink />
    </header>

    <ConnectionPanel />

    <section class="targets">
      <div class="row">
        <span class="label">Project</span>
        <span class="value project-value" :title="target?.project ?? undefined">{{ projectText }}</span>
        <button v-if="bound" type="button" class="change-project" title="Change project" @click="openProjects">
          change
        </button>
      </div>
      <div class="row">
        <span class="label">Session</span>
        <span class="value session-value" :title="target?.session?.title ?? undefined">{{ sessionText }}</span>
      </div>
      <button v-if="state === 'unbound'" type="button" class="choose-project" @click="openProjects">
        Choose project
      </button>
      <p v-if="target?.session" class="session-id" :data-session-id="target.session.id">
        {{ target.session.id }}
      </p>
      <button type="button" class="new-session" :disabled="!bound || rollingOver" @click="newSession">
        {{ rollingOver ? 'Starting…' : '+ new session' }}
      </button>
    </section>

    <section v-if="projectsOpen" class="projects">
      <p v-if="projectsLoading" class="empty">Loading projects…</p>
      <p v-else-if="projectsError" class="projects-error">{{ projectsError }}</p>
      <p v-else-if="projects.length === 0" class="empty">No projects on the server.</p>
      <ul v-else class="project-list">
        <li v-for="project in projects" :key="project.directory">
          <button
            type="button"
            class="project-choice"
            :class="{ current: project.directory === target?.project }"
            :disabled="binding"
            @click="chooseProject(project.directory)"
          >
            <span class="project-name">{{ project.name }}</span>
            <span class="project-dir">{{ project.directory }}</span>
          </button>
        </li>
      </ul>
      <div class="projects-actions">
        <button v-if="!projectsLoading" type="button" :disabled="binding" @click="openProjects">Refresh</button>
        <button type="button" @click="closeProjects">Close</button>
      </div>
    </section>

    <div class="actions">
      <ArmPickerButton />
      <CommentOnPageButton />
    </div>

    <section class="outbox">
      <h2>Outbox</h2>
      <p v-if="!loaded" class="empty">Loading…</p>
      <p v-else-if="outbox.length === 0" class="empty">Nothing waiting.</p>
      <ul v-else class="items">
        <li v-for="item in outbox" :key="item.id" class="item outbox-item">
          <span class="item-title">{{ item.comment || '(no comment)' }}</span>
          <span class="item-meta">
            {{ formatTimestamp(item.capturedAt) }} · {{ item.facts.page.title || item.facts.page.url }}
          </span>
          <p v-if="item.error" class="item-error">{{ item.error }}</p>
          <div class="item-actions">
            <button type="button" :disabled="retrying !== null" @click="retry(item.id)">
              {{ retrying === item.id ? 'Retrying…' : 'Retry' }}
            </button>
            <button type="button" :disabled="retrying !== null" @click="discard(item.id)">Discard</button>
          </div>
        </li>
      </ul>
    </section>

    <section class="sent">
      <h2>Sent</h2>
      <p v-if="!loaded" class="empty">Loading…</p>
      <p v-else-if="sent.length === 0" class="empty">Nothing sent yet.</p>
      <ul v-else class="items">
        <li v-for="entry in sent" :key="entry.id" class="item sent-item">
          <span class="item-title">{{ entry.comment || entry.page.title || '(no comment)' }}</span>
          <span class="item-meta">{{ formatTimestamp(entry.sentAt) }} · {{ entry.session.title }}</span>
        </li>
      </ul>
    </section>

    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>

<style scoped>
.change-project {
  padding: 2px 6px;
  font-size: 10px;
  color: light-dark(#636366, #aeaeb2);
}

.choose-project {
  text-align: center;
}

.projects {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.projects-error {
  margin: 0;
  font-size: 11px;
  color: #ff3b30;
  overflow-wrap: anywhere;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.project-choice {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.project-choice.current {
  border-color: #34c759;
}

.project-name {
  font-size: 12px;
}

.project-dir {
  font-size: 10px;
  color: light-dark(#8e8e93, #98989d);
  overflow-wrap: anywhere;
}

.projects-actions {
  display: flex;
  gap: 6px;
}

.projects-actions button {
  flex: 1;
  padding: 4px 8px;
  font-size: 11px;
  text-align: center;
}

.new-session {
  margin-top: 2px;
  text-align: center;
}

.session-id {
  margin: 0;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: light-dark(#8e8e93, #98989d);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border: 1px solid light-dark(#d1d1d6, #3a3a3c);
  border-radius: 8px;
  background: light-dark(#ffffff, #2c2c2e);
}

.item-title {
  font-size: 12px;
  overflow-wrap: anywhere;
}

.item-meta {
  font-size: 11px;
  color: light-dark(#636366, #aeaeb2);
  overflow-wrap: anywhere;
}

.item-error {
  margin: 2px 0 0;
  font-size: 11px;
  color: #ff3b30;
  overflow-wrap: anywhere;
}

.item-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.item-actions button {
  padding: 4px 8px;
  font-size: 11px;
  text-align: center;
}

.error {
  margin: 0;
  font-size: 11px;
  color: #ff3b30;
  overflow-wrap: anywhere;
}
</style>
