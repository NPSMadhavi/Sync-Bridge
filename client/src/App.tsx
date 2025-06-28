import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import AssetsPage from "@/pages/assets-page";
import EmployeesPage from "@/pages/employees-page";
import DocumentsPage from "@/pages/documents-page";
import PayrollPage from "@/pages/simple-payroll-page";
import VendorsPage from "@/pages/vendors-page";
import SettingsPage from "@/pages/settings-page";
import ReportsPage from "@/pages/reports-page";
import AuditLogsPage from "@/pages/audit-logs-page";
import LicensesPage from "@/pages/licenses-page";
import CustomersPage from "@/pages/customers-page";
import InvoicesPage from "@/pages/invoices-page";
import UserManagementPage from "@/pages/user-management-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { useEffect } from "react";

// Initialize theme based on localStorage or system preference
const initializeTheme = () => {
  const storedTheme = localStorage.getItem("theme");
  const root = window.document.documentElement;
  
  if (storedTheme === "dark") {
    root.classList.add("dark");
  } else if (storedTheme === "light") {
    root.classList.add("light");
  } else {
    // Default to system preference
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(systemPrefersDark ? "dark" : "light");
  }
};

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/assets" component={AssetsPage} />
      <ProtectedRoute path="/employees" component={EmployeesPage} />
      <ProtectedRoute path="/documents" component={DocumentsPage} />
      <ProtectedRoute path="/payroll" component={PayrollPage} />
      <ProtectedRoute path="/licenses" component={LicensesPage} />
      <ProtectedRoute path="/vendors" component={VendorsPage} />
      <ProtectedRoute path="/customers" component={CustomersPage} />
      <ProtectedRoute path="/invoices" component={InvoicesPage} />
      <ProtectedRoute path="/users" component={UserManagementPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/audit-logs" component={AuditLogsPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
