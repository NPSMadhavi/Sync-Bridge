import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface RevealFieldProps {
  value: string;
  maskedValue: string;
  className?: string;
  onReveal?: () => void;
}

export function RevealField({ value, maskedValue, className, onReveal }: RevealFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRevealed && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRevealed(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRevealed, timeLeft]);

  const handleReveal = () => {
    setIsRevealed(true);
    setTimeLeft(30);
    onReveal?.();
  };

  const displayValue = isRevealed ? value : maskedValue;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="font-mono">{displayValue}</span>
      {!isRevealed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReveal}
          className="h-6 w-6 p-0"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {isRevealed && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled
          >
            <EyeOff className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {timeLeft}s
          </span>
        </div>
      )}
    </div>
  );
} 