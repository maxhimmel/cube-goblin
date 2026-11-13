import { useCallback, useEffect, useRef, useState } from "react";

export const PEEK_RELEASE_MS = 150;

export function usePeek(): {
  peek: string | undefined;
  setPeek: (key: string | undefined) => void;
  clearPeek: () => void;
} {
  const [peek, setNow] = useState<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = useCallback(() => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);
  useEffect(() => cancel, [cancel]);
  const setPeek = useCallback(
    (key: string | undefined) => {
      cancel();
      if (key !== undefined) {
        setNow(key);
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = undefined;
        setNow(undefined);
      }, PEEK_RELEASE_MS);
    },
    [cancel],
  );
  const clearPeek = useCallback(() => {
    cancel();
    setNow(undefined);
  }, [cancel]);
  return { peek, setPeek, clearPeek };
}
