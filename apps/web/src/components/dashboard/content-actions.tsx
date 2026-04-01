'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Edit2 } from 'lucide-react';

interface ContentActionsProps {
  contentId: string;
  currentStatus: string;
  currentBody?: string;
}

export function ContentActions({ contentId, currentStatus, currentBody }: ContentActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [editedBody, setEditedBody] = useState(currentBody ?? '');

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!response.ok) throw new Error('Failed to approve');
      router.refresh();
    } catch (error) {
      console.error('Failed to approve content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          rejectionReason: rejectionReason || 'No reason provided',
        }),
      });
      if (!response.ok) throw new Error('Failed to reject');
      setShowRejectDialog(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to reject content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editedBody }),
      });
      if (!response.ok) throw new Error('Failed to save');
      setShowEditDialog(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to save edit:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (currentStatus !== 'pending_review') return null;

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="default" onClick={handleApprove} disabled={isLoading}>
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowEditDialog(true)} disabled={isLoading}>
          <Edit2 className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={isLoading}>
          <XCircle className="h-4 w-4 mr-1" />
          Reject
        </Button>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Content</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this content (optional)</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isLoading}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
            <DialogDescription>Make changes to the content body</DialogDescription>
          </DialogHeader>
          <Textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isLoading}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
