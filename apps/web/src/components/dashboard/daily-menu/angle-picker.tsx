'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AngleCard {
  id: string;
  angle_type: string;
  hook: string;
  thesis: string;
  estimated_engagement: string;
  domain_source: string;
}

interface AnglePickerProps {
  angles: AngleCard[];
  onSelect?: (angleId: string) => void;
  disabled?: boolean;
}

export function AnglePicker({ angles, onSelect, disabled = false }: AnglePickerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-zinc-400 hover:text-zinc-300"
        disabled={disabled}
      >
        {expanded ? (
          <>
            <ChevronUp className="mr-1 h-3 w-3" />
            Hide Angles
          </>
        ) : (
          <>
            <ChevronDown className="mr-1 h-3 w-3" />
            View {angles.length} Angles
          </>
        )}
      </Button>

      {expanded && (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          {angles.map((angle) => (
            <div
              key={angle.id}
              className="rounded-md border border-zinc-800 bg-zinc-900 p-3 hover:border-zinc-700 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-violet-900 text-violet-300 text-xs">
                    {angle.angle_type.replace(/_/g, ' ')}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {angle.estimated_engagement}
                  </Badge>
                  <span className="text-xs text-zinc-500">{angle.domain_source}</span>
                </div>

                <p className="text-sm font-medium text-zinc-50">{angle.hook}</p>
                <p className="text-xs text-zinc-400">{angle.thesis}</p>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => onSelect?.(angle.id)}
                  disabled={disabled}
                >
                  {disabled ? 'Generating...' : 'Select This Angle'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
