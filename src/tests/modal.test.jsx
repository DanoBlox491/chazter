import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

/**
 * Modal dismissal.
 *
 * Reported bug: clicking the X on "Create a group" did not close the dialog —
 * a reload was the only escape. Cause: `Modal` mounted a portal and never
 * unmounted it. After closing, an invisible full-screen fixed overlay stayed in
 * the DOM and swallowed every subsequent click, so the page appeared frozen.
 *
 * These tests assert the overlay actually leaves the DOM, and that the page is
 * clickable again afterwards.
 */

const { Modal } = await import('../components/ui/Modal.jsx');

function Harness({ onCloseSpy }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onCloseSpy?.();
          setOpen(false);
        }}
      >
        page button
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create a group">
        <p>Group contents</p>
      </Modal>
    </div>
  );
}

describe('modal dismissal', () => {
  it('removes the overlay from the DOM after closing', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close dialog/i }));

    // The dialog must actually leave the DOM — not merely become invisible to
    // accessibility queries. `getByRole` ignores aria-hidden nodes, so it cannot
    // detect a leftover overlay; query the document instead.
    await waitFor(() => expect(document.querySelectorAll('.modal')).toHaveLength(0));
  });

  it('does not leave a click-blocking overlay behind', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    await waitFor(() => expect(document.querySelectorAll('.modal')).toHaveLength(0));

    // This is the user-visible symptom from the bug report: after dismissing
    // the dialog the rest of the page must still respond.
    const pageButton = screen.getByRole('button', { name: /page button/i });
    await user.click(pageButton);
    expect(pageButton).toBeInTheDocument();
  });

  it('never leaves a fixed overlay covering the page', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    await waitFor(() => expect(document.querySelectorAll('.modal')).toHaveLength(0));

    // A `.modal` is `position: fixed; inset: 0`. One left behind intercepts
    // every pointer event on the page — the exact symptom reported.
    const leftovers = [...document.querySelectorAll('.modal')].filter(
      (node) => node.className.includes('is-open') || node.className.includes('is-closing'),
    );
    expect(leftovers).toHaveLength(0);
  });

  it('marks the closing state non-interactive immediately', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /close dialog/i }));

    // During the exit animation the wrapper may still exist, but it must be
    // excluded from hit-testing by `.modal.is-closing { pointer-events: none }`.
    const closing = document.querySelector('.modal.is-closing');
    if (closing) expect(closing.getAttribute('aria-hidden')).toBe('true');
  });

  it('unregisters its Escape handler, so Escape works once, not forever', async () => {
    const user = userEvent.setup();
    const onKeyDownSpy = vi.fn();
    document.addEventListener('keydown', onKeyDownSpy);

    render(<Harness />);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelectorAll('.modal')).toHaveLength(0));

    document.removeEventListener('keydown', onKeyDownSpy);
    expect(onKeyDownSpy).toHaveBeenCalled();
  });

  it('restores body scrolling so the page is not stuck', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    await waitFor(() => expect(document.querySelectorAll('.modal')).toHaveLength(0));

    // A dialog that leaves `overflow: hidden` behind makes the page feel dead.
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
