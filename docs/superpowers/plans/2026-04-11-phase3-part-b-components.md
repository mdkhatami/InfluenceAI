# Phase 3 — Part B: Client Components for Review Detail Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build four reusable components for the review detail page: inline-editable title, inline-editable body with character count, review action buttons (copy/approve/reject/publish), and a source signal info card.

**Architecture:** Three client components (`'use client'`) handle user interaction and call `PUT /api/content/[id]` for saves. One server component displays the linked signal data. All components use the project's dark-mode palette (zinc-950/900/800 + violet accents).

**Tech Stack:** Next.js 15 App Router, React 19, shadcn/ui (Button, Badge, Textarea, Card), Tailwind CSS v4, sonner (toast), lucide-react icons

**Prerequisites:** Part A must be completed first (sonner installed, Toaster in root layout, publishedAt API mapping).

---

### Task 1: Create `EditableTitle` component

**Files:**
- Create: `apps/web/src/components/dashboard/editable-title.tsx`

- [ ] **Step 1: Create the EditableTitle client component**

Create `apps/web/src/components/dashboard/editable-title.tsx` with the following content:

```tsx
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
```

- [ ] **Step 2: Verify the component compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 2: Create `EditableBody` component

**Files:**
- Create: `apps/web/src/components/dashboard/editable-body.tsx`

- [ ] **Step 1: Create the EditableBody client component**

Create `apps/web/src/components/dashboard/editable-body.tsx` with the following content:

```tsx
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
```

- [ ] **Step 2: Verify the component compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 3: Create `ReviewActions` component

**Files:**
- Create: `apps/web/src/components/dashboard/review-actions.tsx`

- [ ] **Step 1: Create the ReviewActions client component**

Create `apps/web/src/components/dashboard/review-actions.tsx` with the following content:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ReviewActionsProps {
  contentId: string;
  currentStatus: string;
  nextId: string | null;
  body: string;
}

export function ReviewActions({
  contentId,
  currentStatus,
  nextId,
  body,
}: ReviewActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const navigateNext = () => {
    if (nextId) {
      router.push(`/review/${nextId}`);
    } else {
      router.push('/review');
    }
  };

  const updateContent = async (payload: Record<string, unknown>) => {
    const response = await fetch(`/api/content/${contentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Request failed');
    }
    return response.json();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setShowPublish(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy — try selecting the text manually');
    }
  };

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await updateContent({ status: 'approved' });
      toast.success('Content approved');
      navigateNext();
    } catch {
      toast.error('Failed to approve content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await updateContent({
        status: 'rejected',
        rejectionReason: rejectionReason || 'No reason provided',
      });
      toast.success('Content rejected');
      navigateNext();
    } catch {
      toast.error('Failed to reject content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkPublished = async () => {
    setIsLoading(true);
    try {
      await updateContent({
        status: 'published',
        publishedAt: new Date().toISOString(),
      });
      toast.success('Marked as published');
      navigateNext();
    } catch {
      toast.error('Failed to mark as published');
    } finally {
      setIsLoading(false);
    }
  };

  const isPending = currentStatus === 'pending_review';

  return (
    <div className="space-y-3">
      {/* Primary actions */}
      <div className="flex flex-col gap-2">
        {/* Copy to Clipboard */}
        <Button
          variant="outline"
          size="lg"
          onClick={handleCopy}
          disabled={isLoading}
          className={
            copied
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
          }
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy to Clipboard
            </>
          )}
        </Button>

        {/* Mark as Published — appears after copy */}
        {showPublish && (
          <Button
            variant="outline"
            size="lg"
            onClick={handleMarkPublished}
            disabled={isLoading}
            className="border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20"
          >
            <Send className="mr-2 h-4 w-4" />
            {isLoading ? 'Saving...' : 'Mark as Published'}
          </Button>
        )}
      </div>

      {/* Approve / Reject — only shown for pending_review items */}
      {isPending && (
        <div className="space-y-2 border-t border-zinc-800 pt-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleApprove}
            disabled={isLoading}
            className="w-full border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {isLoading ? 'Saving...' : 'Approve'}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowReject(!showReject)}
            disabled={isLoading}
            className="w-full border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
            {showReject ? (
              <ChevronUp className="ml-auto h-4 w-4" />
            ) : (
              <ChevronDown className="ml-auto h-4 w-4" />
            )}
          </Button>

          {/* Rejection reason textarea */}
          {showReject && (
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <Textarea
                placeholder="Why are you rejecting this content? (optional)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="border-zinc-700 bg-zinc-900 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReject(false);
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleReject}
                  disabled={isLoading}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {isLoading ? 'Rejecting...' : 'Confirm Reject'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 4: Create `SourceSignalCard` server component

**Files:**
- Create: `apps/web/src/components/dashboard/source-signal-card.tsx`

- [ ] **Step 1: Create the SourceSignalCard server component**

Create `apps/web/src/components/dashboard/source-signal-card.tsx` with the following content. Note: this is a **server component** (no `'use client'` directive).

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Newspaper, Github, Radio, Rss } from 'lucide-react';

interface SourceSignal {
  title: string;
  url: string;
  summary: string | null;
  source: string;
  source_type: string | null;
}

interface SourceSignalCardProps {
  signal: SourceSignal | null;
}

const sourceTypeIcons: Record<string, typeof Github> = {
  github_trending: Github,
  rss: Rss,
  hackernews: Newspaper,
  twitter: Radio,
};

const sourceTypeLabels: Record<string, string> = {
  github_trending: 'GitHub Trending',
  rss: 'RSS Feed',
  hackernews: 'Hacker News',
  twitter: 'Twitter/X',
};

export function SourceSignalCard({ signal }: SourceSignalCardProps) {
  if (!signal) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-4">
          <p className="text-sm text-zinc-500">No source signal linked</p>
        </CardContent>
      </Card>
    );
  }

  const SourceIcon = sourceTypeIcons[signal.source_type ?? ''] ?? Newspaper;
  const sourceLabel = sourceTypeLabels[signal.source_type ?? ''] ?? signal.source;
  const truncatedSummary =
    signal.summary && signal.summary.length > 200
      ? signal.summary.slice(0, 200) + '...'
      : signal.summary;

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-400">
            Source Signal
          </CardTitle>
          <Badge variant="secondary" className="gap-1 text-xs">
            <SourceIcon className="h-3 w-3" />
            {sourceLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <h4 className="font-medium text-zinc-200">{signal.title}</h4>

        {truncatedSummary && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {truncatedSummary}
          </p>
        )}

        {signal.url && (
          <a
            href={signal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-400 transition-colors hover:text-violet-300"
          >
            <ExternalLink className="h-3 w-3" />
            View original source
          </a>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 5: Commit

```bash
git add apps/web/src/components/dashboard/editable-title.tsx \
       apps/web/src/components/dashboard/editable-body.tsx \
       apps/web/src/components/dashboard/review-actions.tsx \
       apps/web/src/components/dashboard/source-signal-card.tsx
git commit -m "feat(review): add review detail page components

- EditableTitle: inline click-to-edit title with save on Enter/blur
- EditableBody: click-to-edit body with auto-resize, char count, platform limits
- ReviewActions: copy/approve/reject/publish workflow with toast feedback
- SourceSignalCard: server component showing linked signal metadata

Phase 3 Part B"
```
