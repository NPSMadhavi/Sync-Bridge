import { Sun } from "lucide-react";
import { Button } from "./button";

/** Theme switching is disabled — application always uses light theme. */
export function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled
      className="rounded-full opacity-60 cursor-not-allowed"
      title="Light theme (theme switching disabled)"
      aria-disabled="true"
    >
      <Sun className="h-5 w-5" />
      <span className="sr-only">Light theme</span>
    </Button>
  );
}
