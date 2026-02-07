import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";

export { Input };
