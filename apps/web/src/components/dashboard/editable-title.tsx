'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface EditableTitleProps {
  initialTitle: string;
  contentId: string;
}

export function EditableTitle({ initialTitle, contentId }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(savedTitle);
      setIsEditing(false);
      return;
    }
    if (trimmed === savedTitle) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!response.ok) throw new Error('Failed to save title');
      setSavedTitle(trimmed);
      setTitle(trimmed);
      setIsEditing(false);
      toast.success('Title updated');
    } catch {
      toast.error('Failed to save title');
      setTitle(savedTitle);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setTitle(savedTitle);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="w-full rounded-lg border border-violet-500/50 bg-zinc-900 px-3 py-2 text-2xl font-bold text-zinc-50 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
        />
        {isSaving && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
            Saving...
          </span>
        )}
      </div>
    );
  }

  return (
    <h1
      onClick={() => setIsEditing(true)}
      title="Click to edit title"
      className="cursor-pointer rounded-lg px-3 py-2 text-2xl font-bold text-zinc-50 transition-colors hover:bg-zinc-800/50"
    >
      {savedTitle}
    </h1>
  );
}
