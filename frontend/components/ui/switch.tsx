import * as React from "react";

import { cn } from "@/lib/utils";

type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
};

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, checked, ...props }, ref) => (
    <label className={cn("flex items-center justify-between gap-4 text-sm text-slate-200", className)}>
      {label ? <span>{label}</span> : null}
      <span className="relative inline-flex h-6 w-11 items-center">
        <input ref={ref} type="checkbox" checked={checked} className="peer sr-only" {...props} />
        <span className="absolute inset-0 rounded-full bg-slate-800 transition peer-checked:bg-emerald-500/60" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
);

Switch.displayName = "Switch";

export { Switch };
