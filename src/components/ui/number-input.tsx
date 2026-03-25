import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumberInput, parseNumberInput } from "@/utils/formatters";

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (value: string) => void;
  allowDecimal?: boolean;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, allowDecimal = true, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => 
      value ? formatNumberInput(value) : ""
    );

    React.useEffect(() => {
      setDisplayValue(value ? formatNumberInput(value) : "");
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      
      // Remove all non-numeric characters except comma and decimal point
      const cleaned = input.replace(/[^\d.,]/g, "");
      
      // Handle decimal point
      if (!allowDecimal) {
        const withoutDecimal = cleaned.replace(/\./g, "");
        const formatted = formatNumberInput(withoutDecimal);
        setDisplayValue(formatted);
        onChange(withoutDecimal.replace(/,/g, ""));
        return;
      }
      
      // Allow only one decimal point
      const parts = cleaned.split(".");
      if (parts.length > 2) {
        return; // Don't update if more than one decimal point
      }
      
      // Format the number
      const formatted = formatNumberInput(cleaned);
      setDisplayValue(formatted);
      
      // Pass back the raw number without commas
      onChange(cleaned.replace(/,/g, ""));
    };

    const handleBlur = () => {
      // Re-format on blur to ensure consistent formatting
      if (displayValue) {
        const parsed = parseNumberInput(displayValue);
        const formatted = formatNumberInput(parsed.toString());
        setDisplayValue(formatted);
      }
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(className)}
        {...props}
      />
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
