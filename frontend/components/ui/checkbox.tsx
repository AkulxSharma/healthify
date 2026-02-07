import * as React from "react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
};

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, checked, ...props }, ref) => (
    <label className={cn("flex items-center gap-3 text-sm text-slate-200", className)}>
      <span className="relative flex h-5 w-5 items-center justify-center rounded-md border border-slate-700 bg-slate-950/60">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          className="peer absolute h-5 w-5 cursor-pointer opacity-0"
          {...props}
        />
        <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400 opacity-0 peer-checked:opacity-100" />
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  )
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
