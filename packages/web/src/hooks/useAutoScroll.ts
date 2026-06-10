import { useEffect, type RefObject } from 'react';

export function useAutoScroll(
  ref: RefObject<HTMLElement | null>,
  trigger: number
): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ref.current) {
        ref.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [trigger, ref]);
}