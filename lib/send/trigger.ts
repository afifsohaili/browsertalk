import { sendQueuedItem } from './send';

export type SendDispatcher = (itemId: string) => void;

function defaultDispatcher(itemId: string): void {
  void sendQueuedItem(itemId).catch((error: unknown) => {
    console.error('Browsertalk: the background send failed', error);
  });
}

let dispatcher: SendDispatcher = defaultDispatcher;

export function setSendDispatcher(next: SendDispatcher): void {
  dispatcher = next;
}

export function resetSendDispatcher(): void {
  dispatcher = defaultDispatcher;
}

export function requestSend(itemId: string): void {
  dispatcher(itemId);
}
