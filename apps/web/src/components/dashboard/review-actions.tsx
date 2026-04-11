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
      router.push('/');
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
            data-review-action="reject"
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
                data-review-action="reject-reason"
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
