import { useEffect } from 'react';

// The game handles hardware keys without an editable field that could summon
// a software keyboard. Leave shortcuts, navigation and button activation alone.
export function useLetterInput(
  active: boolean,
  letter: (key: string) => void,
  erase: () => void,
  submit: () => void,
) {
  useEffect(() => {
    if (!active) return;
    function keydown(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        (target instanceof Element &&
          target.closest(
            'header, footer, a, input, textarea, select, summary, [contenteditable]',
          ))
      )
        return;
      if (/^[a-z]$/i.test(event.key)) letter(event.key.toUpperCase());
      else if (event.key === 'Backspace') erase();
      else if (
        event.key === 'Enter' &&
        !(
          target instanceof Element && target.closest('button, [role="button"]')
        )
      ) {
        if (!event.repeat) submit();
      } else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [active, letter, erase, submit]);
}
