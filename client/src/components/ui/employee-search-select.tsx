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

export interface EmployeeOption {
  id: number;
  name: string;
  employeeId?: string;
  department?: string;
  designation?: string;
}

interface EmployeeSearchSelectProps {
  employees: EmployeeOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** "department" for asset assignment, "designation" for payroll */
  subtitle?: "department" | "designation";
}

function getEmployeeSubtitle(employee: EmployeeOption, subtitle: "department" | "designation") {
  if (subtitle === "designation") {
    const code = employee.employeeId ? `(${employee.employeeId})` : "";
    const role = employee.designation ? ` — ${employee.designation}` : "";
    return `${code}${role}`.trim();
  }
  return employee.department ? `(${employee.department})` : "";
}

export function EmployeeSearchSelect({
  employees,
  value,
  onValueChange,
  placeholder = "Search employee...",
  disabled = false,
  subtitle = "department",
}: EmployeeSearchSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedEmployee = React.useMemo(
    () => employees.find((e) => e.id.toString() === value),
    [employees, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate text-left">
            {selectedEmployee
              ? `${selectedEmployee.name} ${getEmployeeSubtitle(selectedEmployee, subtitle)}`.trim()
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search employee..." />
          <CommandList>
            <CommandEmpty>No employee found.</CommandEmpty>
            <CommandGroup>
              {employees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={`${employee.name} ${employee.employeeId || ""} ${employee.department || ""} ${employee.designation || ""}`}
                  onSelect={() => {
                    onValueChange(employee.id.toString());
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === employee.id.toString() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{employee.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {getEmployeeSubtitle(employee, subtitle) || employee.employeeId || "—"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
