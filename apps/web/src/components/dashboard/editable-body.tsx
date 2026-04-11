'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';

interface EditableBodyProps {
  initialBody: string;
  contentId: string;
  platform: string;
}

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  youtube: 5000,
};

export function EditableBody({ initialBody, contentId, platform }: EditableBodyProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [body, setBody] = useState(initialBody);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charLimit = PLATFORM_CHAR_LIMITS[platform] ?? null;
  const isOverLimit = charLimit !== null && body.length > charLimit;
  const hasChanges = body !== savedBody;

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing) {
      autoResize();
      textareaRef.current?.focus();
    }
  }, [isEditing, autoResize]);

  const handleSave = async () => {
    if (body === savedBody) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) throw new Error('Failed to save body');
      setSavedBody(body);
      setIsEditing(false);
      toast.success('Content updated');
    } catch {
      toast.error('Failed to save content');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setBody(savedBody);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Expose startEditing for keyboard shortcuts
  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Attach startEditing to the DOM element so keyboard-shortcuts can trigger it
  useEffect(() => {
    const el = document.getElementById('editable-body-trigger');
    if (el) {
      (el as HTMLElement & { __startEditing?: () => void }).__startEditing = startEditing;
    }
  }, [startEditing]);

  if (isEditing) {
    return (
      <div className="space-y-3">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="w-full resize-none rounded-lg border border-violet-500/50 bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
          style={{ minHeight: '200px' }}
        />

        {/* Character count + action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {charLimit !== null && (
              <span
                className={`text-xs ${
                  isOverLimit
                    ? 'font-semibold text-red-400'
                    : body.length > charLimit * 0.9
                      ? 'text-amber-400'
                      : 'text-zinc-500'
                }`}
              >
                {body.length}/{charLimit}
                {isOverLimit && ` (${body.length - charLimit} over)`}
              </span>
            )}
            {!charLimit && (
              <span className="text-xs text-zinc-500">{body.length} characters</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="editable-body-trigger" className="group relative">
      <div
        onClick={() => setIsEditing(true)}
        title="Click to edit content"
        className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-zinc-700"
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
          {savedBody || 'No content body'}
        </p>
      </div>
      <button
        onClick={() => setIsEditing(true)}
        className="absolute right-3 top-3 rounded-md bg-zinc-800 p-1.5 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-200"
        title="Edit content"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
