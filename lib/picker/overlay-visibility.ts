export interface OverlayVisibility {
  hide: () => void;
  show: () => void;
}

export interface OverlayHolds {
  count: () => number;
  hold: () => () => void;
  guard: <T>(operation: () => Promise<T>) => Promise<T>;
}

export function createOverlayHolds(visibility: OverlayVisibility): OverlayHolds {
  let held = 0;

  function hold(): () => void {
    held += 1;
    if (held === 1) visibility.hide();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      held -= 1;
      if (held === 0) visibility.show();
    };
  }

  async function guard<T>(operation: () => Promise<T>): Promise<T> {
    const release = hold();
    try {
      return await operation();
    } finally {
      release();
    }
  }

  return { count: () => held, hold, guard };
}
