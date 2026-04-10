export const dynamic = 'force-dynamic';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getContentItems } from '@/lib/queries/content';
import { ReviewCard } from './review-card';

export default async function ReviewPage() {
  let pendingItems: Awaited<ReturnType<typeof getContentItems>>['items'] = [];
  let approvedItems: Awaited<ReturnType<typeof getContentItems>>['items'] = [];
  let rejectedItems: Awaited<ReturnType<typeof getContentItems>>['items'] = [];

  try {
    const [pending, approved, rejected] = await Promise.all([
      getContentItems({ status: 'pending_review', limit: 50 }),
      getContentItems({ status: 'approved', limit: 50 }),
      getContentItems({ status: 'rejected', limit: 50 }),
    ]);
    pendingItems = pending.items;
    approvedItems = approved.items;
    rejectedItems = rejected.items;
  } catch (error) {
    console.error('Failed to fetch review items:', error);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-zinc-50">Review Queue</h1>
        {pendingItems.length > 0 && (
          <Badge variant="warning" className="text-sm">{pendingItems.length} pending</Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingItems.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedItems.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="space-y-4">
            {pendingItems.length === 0 && (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">No content pending review</p>
              </div>
            )}
            {pendingItems.map((item) => (
              <ReviewCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="approved">
          <div className="space-y-4">
            {approvedItems.length === 0 && (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">No approved content</p>
              </div>
            )}
            {approvedItems.map((item) => (
              <ReviewCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rejected">
          <div className="space-y-4">
            {rejectedItems.length === 0 && (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">No rejected content</p>
              </div>
            )}
            {rejectedItems.map((item) => (
              <ReviewCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
