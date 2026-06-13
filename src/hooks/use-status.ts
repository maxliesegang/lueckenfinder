import { useCallback, useEffect, useRef, useState } from "react";

export interface Status {
  message: string;
  loading: boolean;
}

export interface StatusController {
  status: Status;
  setStatus: (message: string, loading?: boolean) => void;
  /** Show a message, then clear it after `ms` milliseconds. */
  setStatusTimed: (message: string, ms?: number) => void;
}

const EMPTY: Status = { message: "", loading: false };

export function useStatus(): StatusController {
  const [status, setStatusState] = useState<Status>(EMPTY);
  const timer = useRef<number | undefined>(undefined);

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  const setStatus = useCallback(
    (message: string, loading = false) => {
      clearTimer();
      setStatusState({ message, loading });
    },
    [clearTimer],
  );

  const setStatusTimed = useCallback(
    (message: string, ms = 3_000) => {
      setStatus(message);
      timer.current = window.setTimeout(() => setStatusState(EMPTY), ms);
    },
    [setStatus],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { status, setStatus, setStatusTimed };
}
