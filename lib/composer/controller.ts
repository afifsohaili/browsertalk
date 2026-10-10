export const EMPTY_COMMENT_ERROR = 'Write a comment first';

export type ComposerQueueResult = { ok: true } | { ok: false; error: string };

export interface ComposerState {
  comment: string;
  busy: boolean;
  error: string | null;
}

export interface ComposerControllerOptions {
  queue: (comment: string) => Promise<ComposerQueueResult>;
  onTransition?: (state: Readonly<ComposerState>) => void;
}

export interface ComposerController {
  getState: () => Readonly<ComposerState>;
  setComment: (value: string) => void;
  submit: () => Promise<boolean>;
  reset: () => void;
}

export function createComposerController(options: ComposerControllerOptions): ComposerController {
  const state: ComposerState = { comment: '', busy: false, error: null };

  function notify(): void {
    options.onTransition?.({ ...state });
  }

  function setComment(value: string): void {
    state.comment = value;
    if (state.error !== null) {
      state.error = null;
      notify();
    }
  }

  async function submit(): Promise<boolean> {
    if (state.busy) return false;

    const comment = state.comment.trim();
    if (comment.length === 0) {
      state.error = EMPTY_COMMENT_ERROR;
      notify();
      return false;
    }

    state.busy = true;
    state.error = null;
    notify();

    const result = await options.queue(comment);
    state.busy = false;
    if (!result.ok) state.error = result.error;
    notify();
    return result.ok;
  }

  function reset(): void {
    state.comment = '';
    state.busy = false;
    state.error = null;
    notify();
  }

  return { getState: () => state, setComment, submit, reset };
}
