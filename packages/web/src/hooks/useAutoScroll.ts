import { useEffect, type RefObject } from 'react';

export function useAutoScroll(
  ref: RefObject<HTMLElement | null>,
  trigger: number,
  ready: boolean = true,
): void {
  useEffect(() => {
    if (!ready) return;

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
  }, [trigger, ref, ready]);
}