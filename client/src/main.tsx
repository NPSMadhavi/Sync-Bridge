import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global fix to prevent mouse wheel from changing number input values
document.addEventListener('DOMContentLoaded', () => {
  // Prevent wheel events on number inputs
  document.addEventListener('wheel', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'number') {
      e.preventDefault();
    }
  }, { passive: false });

  // Also handle focus events to ensure the fix works
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'number') {
      target.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    }
  });
});

createRoot(document.getElementById("root")!).render(<App />);
