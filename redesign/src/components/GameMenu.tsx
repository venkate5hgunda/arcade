import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function GameMenu({
  children,
  label = 'Game menu',
}: {
  children: ReactNode;
  label?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  return (
    <div className="game-menu">
      <button
        ref={trigger}
        className="quiet"
        aria-haspopup="dialog"
        aria-label={typeof label === 'string' ? label : undefined}
        onClick={() => setOpen(true)}
      >
        {label === 'Game menu' ? 'Menu' : label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={title}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key !== 'Tab') return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
            ),
          ].filter(
            (element) =>
              element.getClientRects().length && !element.matches(':disabled'),
          );
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
          const action = (event.target as HTMLElement).closest(
            'a[href],button',
          );
          if (
            action &&
            !action.hasAttribute('aria-pressed') &&
            !action.hasAttribute('aria-expanded') &&
            !action.hasAttribute('aria-haspopup') &&
            action.getAttribute('role') !== 'switch'
          )
            close();
          if (event.target === dialog.current) {
            const bounds = dialog.current.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              close();
          }
        }}
      >
        {open && (
          <>
            <div className="game-menu-heading">
              <h2 id={title}>{label}</h2>
              <button className="quiet" onClick={close} aria-label="Close menu">
                Close
              </button>
            </div>
            {children}
          </>
        )}
      </dialog>
    </div>
  );
}
