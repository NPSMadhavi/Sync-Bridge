import { Switch, Route, useLocation } from "wouter";
import { queryClient, setAuthNavigationCallback } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import AssetsPage from "@/pages/assets-page";
import EmployeesPage from "@/pages/employees-page";
import CompaniesPage from "@/pages/companies-page";
import DocumentsPage from "@/pages/documents-page";
import PayrollPage from "@/pages/clean-payroll-page";
import VendorsPage from "@/pages/vendors-page";
import SettingsPage from "@/pages/settings-page";
import VendorSettingsPage from "@/pages/vendor-settings-page";
import VendorOrdersPage from "@/pages/vendor-orders-page";
import VendorDashboardPage from "@/pages/vendor-dashboard-page";
import ProductsPage from "@/pages/products-page";
import ReportsPage from "@/pages/reports-page";
import AuditLogsPage from "@/pages/audit-logs-page";
import LicensesPage from "@/pages/licenses-page";
import CustomersPage from "@/pages/customers-page";
import InvoicesPage from "@/pages/invoices-page";
import UserManagementPage from "@/pages/user-management-page";
import NotificationsPage from "@/pages/notifications-page";
import InterviewSlotsPage from "@/pages/interview-slots-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";

// Always use light theme — theme switching is disabled
const initializeTheme = () => {
  const root = window.document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add("light");
  localStorage.setItem("theme", "light");
};

function Router() {
  const [location, setLocation] = useLocation();
  const isVendorOrdersOpen = location === "/vendor-orders";
  const { user } = useAuth();

  return (
    <>
      <Switch>
        <Route path="/">
          {!user ? <Redirect to="/auth" /> : user.role === 'vendor' ? <Redirect to="/vendor-dashboard" /> : <HomePage />}
        </Route>
        <ProtectedRoute path="/assets" component={AssetsPage} />
        <ProtectedRoute path="/company" component={CompaniesPage} />
        <ProtectedRoute path="/employees" component={EmployeesPage} />
        <ProtectedRoute path="/documents" component={DocumentsPage} />
        <ProtectedRoute path="/payroll" component={PayrollPage} />
        <ProtectedRoute path="/licenses" component={LicensesPage} />
        <ProtectedRoute path="/vendors" component={VendorsPage} />
        <ProtectedRoute path="/customers" component={CustomersPage} />
        <ProtectedRoute path="/invoices" component={InvoicesPage} />
        <ProtectedRoute path="/users" component={UserManagementPage} />
        <ProtectedRoute path="/notifications" component={NotificationsPage} />
        <ProtectedRoute path="/interview-slots" component={InterviewSlotsPage} />
        <ProtectedRoute path="/settings" component={SettingsPage} />
        <ProtectedRoute path="/vendor-settings" component={VendorSettingsPage} />
        <ProtectedRoute path="/vendor-dashboard" component={VendorDashboardPage} />
        <ProtectedRoute path="/products" component={ProductsPage} />
        <ProtectedRoute path="/reports" component={ReportsPage} />
        <ProtectedRoute path="/audit-logs" component={AuditLogsPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/vendor-orders" element={<div />} />
        <Route component={NotFound} />
      </Switch>
      {/* Vendor Orders Sheet */}
      <Sheet open={isVendorOrdersOpen} onOpenChange={open => { if (!open) setLocation("/"); }}>
        <SheetContent side="right" className="p-0 overflow-y-auto" style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}>
          <VendorOrdersPage />
        </SheetContent>
      </Sheet>
    </>
  );
}

function App() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    initializeTheme();
  }, []);

  useEffect(() => {
    // Set up the navigation callback for 401 redirects
    setAuthNavigationCallback(() => {
      setLocation("/auth");
    });
  }, [setLocation]);

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
