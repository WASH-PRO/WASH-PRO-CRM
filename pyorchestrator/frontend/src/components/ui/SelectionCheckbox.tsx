import { cn } from "@/lib/cn";
import { useEffect, useRef } from "react";

interface SelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export function SelectionCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
  className,
  disabled,
}: SelectionCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "size-4 rounded border-line-strong bg-input text-cyan-400",
        "focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-0",
        className,
      )}
    />
  );
}
