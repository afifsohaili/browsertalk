import { installRouteEmitter, PICKER_ROUTE_EVENT } from '@/lib/picker/route';

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installRouteEmitter({
      history: window.history,
      dispatch: () => window.dispatchEvent(new Event(PICKER_ROUTE_EVENT)),
    });
  },
});
