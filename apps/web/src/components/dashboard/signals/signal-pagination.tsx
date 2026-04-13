'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface SignalPaginationProps {
  currentPage: number;
  totalPages: number;
}

export function SignalPagination({ currentPage, totalPages }: SignalPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/signals?${params.toString()}`);
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-4 text-sm">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => navigate(currentPage - 1)}
      >
        ← Prev
      </Button>
      <span className="text-zinc-400">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages}
        onClick={() => navigate(currentPage + 1)}
      >
        Next →
      </Button>
    </div>
  );
}
