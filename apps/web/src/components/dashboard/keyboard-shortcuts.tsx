'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface KeyboardShortcutsProps {
  contentId: string;
  nextId: string | null;
  previousId: string | null;
  body: string;
}

export function KeyboardShortcuts({
  contentId,
  nextId,
  previousId,
  body,
}: KeyboardShortcutsProps) {
  const router = useRouter();

  const isInputFocused = useCallback(() => {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }, []);

  const navigateNext = useCallback(() => {
    if (nextId) {
      router.push(`/review/${nextId}`);
    } else {
      toast.info('No more items in queue');
    }
  }, [nextId, router]);

  const navigatePrev = useCallback(() => {
    if (previousId) {
      router.push(`/review/${previousId}`);
    } else {
      toast.info('Already at the first item');
    }
  }, [previousId, router]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, [body]);

  const handleApprove = useCallback(async () => {
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!response.ok) throw new Error('Failed to approve');
      toast.success('Content approved');
      if (nextId) {
        router.push(`/review/${nextId}`);
      } else {
        router.push('/');
      }
    } catch {
      toast.error('Failed to approve content');
    }
  }, [contentId, nextId, router]);

  const handleEdit = useCallback(() => {
    // Trigger the editable body's edit mode via the DOM hook set in EditableBody
    const el = document.getElementById('editable-body-trigger') as
      | (HTMLElement & { __startEditing?: () => void })
      | null;
    if (el?.__startEditing) {
      el.__startEditing();
    }
  }, []);

  const handleFocusReject = useCallback(() => {
    // Click the reject button to expand it, then focus the textarea
    const rejectButton = document.querySelector(
      '[data-review-action="reject"]',
    ) as HTMLButtonElement | null;
    if (rejectButton) {
      rejectButton.click();
      // Small delay to let the textarea render
      setTimeout(() => {
        const textarea = document.querySelector(
          '[data-review-action="reject-reason"]',
        ) as HTMLTextAreaElement | null;
        textarea?.focus();
      }, 100);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input or textarea
      if (isInputFocused()) {
        // Escape should still work to cancel editing
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'c':
          e.preventDefault();
          handleCopy();
          break;
        case 'a':
          e.preventDefault();
          handleApprove();
          break;
        case 'r':
          e.preventDefault();
          handleFocusReject();
          break;
        case 'e':
          e.preventDefault();
          handleEdit();
          break;
        case 'j':
        case 'ArrowRight':
          e.preventDefault();
          navigateNext();
          break;
        case 'k':
        case 'ArrowLeft':
          e.preventDefault();
          navigatePrev();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isInputFocused,
    handleCopy,
    handleApprove,
    handleFocusReject,
    handleEdit,
    navigateNext,
    navigatePrev,
  ]);

  // Render keyboard hints bar at bottom of screen
  return (
    <div className="fixed bottom-0 left-64 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-6 px-4 py-2">
        {[
          { key: 'c', label: 'Copy' },
          { key: 'a', label: 'Approve' },
          { key: 'r', label: 'Reject' },
          { key: 'e', label: 'Edit' },
          { key: 'k/\u2190', label: 'Prev' },
          { key: 'j/\u2192', label: 'Next' },
          { key: 'Esc', label: 'Cancel' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {key}
            </kbd>
            <span className="text-[11px] text-zinc-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
