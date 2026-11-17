import { useCallback, useRef, useState } from 'react';

export function useSubmitLock() {
  const locked = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = useCallback(async <T,>(action: () => Promise<T>) => {
    if (locked.current) return undefined;
    locked.current = true;
    setIsSubmitting(true);
    try {
      return await action();
    } finally {
      locked.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, run };
}
