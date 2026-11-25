import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-tint text-primary',
      success: 'bg-[#e8efdf] text-primary',
      warning: 'bg-[#f7eccf] text-[#8a5a00]',
      info: 'bg-[#dfeaf3] text-[#255a85]',
      danger: 'bg-[#f6dcd8] text-[#9a2f22]',
      muted: 'bg-muted text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
