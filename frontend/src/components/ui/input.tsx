import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
