import { registerBuiltinBackends } from '@/lib/agent-backend';
import { registerBuiltinSessionStrategies } from '@/lib/session-strategy';
import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

registerBuiltinBackends();
registerBuiltinSessionStrategies();
createApp(App).mount('#app');
