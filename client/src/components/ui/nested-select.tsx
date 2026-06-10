import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NestedSelectOption {
  id: number;
  name: string;
  description?: string;
}

interface NestedSelectProps {
  options: Record<string, NestedSelectOption[]>;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function NestedSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  disabled = false,
}: NestedSelectProps) {
  const [open, setOpen] = React.useState(false);

  // Find the selected option to display its name
  const selectedOption = React.useMemo(() => {
    for (const [category, items] of Object.entries(options)) {
      const found = items.find(item => item.id.toString() === value);
      if (found) return found;
    }
    return null;
  }, [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedOption ? selectedOption.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search products..." />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            {Object.entries(options).map(([category, items]) => (
              <CommandGroup key={category} heading={category} className="font-bold text-lg">
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.description || ''} ${category}`}
                    onSelect={() => {
                      onValueChange(item.id.toString());
                      setOpen(false);
                    }}
                    className="font-normal text-sm"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.id.toString() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-normal text-sm">{item.name}</span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 