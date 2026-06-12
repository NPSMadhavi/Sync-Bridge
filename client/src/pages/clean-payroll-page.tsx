import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Dashboard from "@/components/layout/Dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import PayrollConfigForm from "@/components/forms/PayrollConfigForm";
import ProcessPayrollForm from "@/components/forms/ProcessPayrollForm";
import {
  Plus,
  Users,
  DollarSign,
  Calculator,
  FileText,
  Edit,
  Eye,
  Loader2,
  Trash2,
  Download,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { exportPayrollConfigsToExcel } from "@/lib/excel-utils";
import {
  getCurrentPayPeriod,
  getProcessedMonthsForEmployee,
  isPayrollProcessedForPeriod,
  processPayrollForConfig,
} from "@/lib/payroll-batch-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TableRowActions } from "@/components/ui/table-row-actions";
import { TablePagination, paginateItems } from "@/components/ui/table-pagination";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EntityViewField,
  EntityViewFieldGrid,
  EntityViewSection,
  EntityViewSheet,
  formatViewDate,
  formatViewStatus,
  formatViewValue,
} from "@/components/ui/entity-view-sheet";

const PAYROLL_CONFIG_PAGE_SIZE = 10;

const PAYSLIP_MONTHS_LEFT = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
];

const PAYSLIP_MONTHS_RIGHT = [
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function buildPayslipDownloadFilename(
  employeeName: string,
  month: number,
  year: number
): string {
  const safeName =
    employeeName
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Employee";
  const monthLabel =
    PAYSLIP_MONTHS_LEFT.concat(PAYSLIP_MONTHS_RIGHT).find((m) => m.value === month)?.label ||
    `Month${month}`;
  return `Payslip_${safeName}_${monthLabel}_${year}.pdf`;
}

function closePayslipViewer(
  url: string | null,
  setOpen: (open: boolean) => void,
  setUrl: (url: string | null) => void
) {
  setOpen(false);
  if (url) {
    window.URL.revokeObjectURL(url);
    setUrl(null);
  }
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  if (filename.endsWith(".zip") || filename.endsWith(".pdf")) {
    anchor.download = filename;
  } else {
    anchor.download = `${filename}.pdf`;
  }
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  anchor.remove();
}

function isZipArrayBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 2) return false;
  const bytes = new Uint8Array(buffer, 0, 2);
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isPdfArrayBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function parseFilenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return match?.[1]?.replace(/"/g, "") || fallback;
}

async function handlePayslipDownloadResponse(
  res: Response,
  fallbackFilename: string
): Promise<{ ok: true; downloaded: number } | { ok: false; message: string }> {
  const arrayBuffer = await res.arrayBuffer();

  if (isPdfArrayBuffer(arrayBuffer)) {
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    const filename = parseFilenameFromDisposition(
      res.headers.get("Content-Disposition"),
      fallbackFilename
    );
    triggerBrowserDownload(blob, filename);
    return { ok: true, downloaded: 1 };
  }

  if (isZipArrayBuffer(arrayBuffer)) {
    const blob = new Blob([arrayBuffer], { type: "application/zip" });
    const filename = parseFilenameFromDisposition(
      res.headers.get("Content-Disposition"),
      fallbackFilename.endsWith(".zip") ? fallbackFilename : `${fallbackFilename}.zip`
    );
    triggerBrowserDownload(blob, filename);
    return { ok: true, downloaded: 1 };
  }

  try {
    const data = JSON.parse(new TextDecoder().decode(arrayBuffer));
    return { ok: false, message: data.message || "Download failed" };
  } catch {
    return { ok: false, message: "Server did not return a valid payslip file" };
  }
}

export default function PayrollPage() {
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [detailsMode, setDetailsMode] = useState<"config" | "record" | null>(null);
  const [openDetail, setOpenDetail] = useState<null | "employees" | "gross" | "net" | "records">(null);
  const { toast } = useToast();
  const [forceDeleteId, setForceDeleteId] = useState<number | null>(null);
  const [showForceDeleteDialog, setShowForceDeleteDialog] = useState(false);
  const [configPage, setConfigPage] = useState(1);
  const [selectedConfigIds, setSelectedConfigIds] = useState<number[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [payslipConfig, setPayslipConfig] = useState<any>(null);
  const [selectedPayslipMonths, setSelectedPayslipMonths] = useState<number[]>([]);
  const [payslipYear, setPayslipYear] = useState(new Date().getFullYear());
  const [isPayslipDownloading, setIsPayslipDownloading] = useState(false);
  const [isPayslipViewing, setIsPayslipViewing] = useState(false);
  const [payslipViewerOpen, setPayslipViewerOpen] = useState(false);
  const [payslipViewerUrl, setPayslipViewerUrl] = useState<string | null>(null);
  const [payslipViewerTitle, setPayslipViewerTitle] = useState("");

  useEffect(() => {
    return () => {
      if (payslipViewerUrl) {
        window.URL.revokeObjectURL(payslipViewerUrl);
      }
    };
  }, [payslipViewerUrl]);

  const { payPeriodStart, payPeriodEnd } = getCurrentPayPeriod();

  // Get user and tenant context
  const { user, isLoading: userLoading, error: userError } = useAuth();
  const tenantId = user?.tenantId;

  // Show loading or error state for user context
  if (userLoading) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading...</span>
        </div>
      </Dashboard>
    );
  }
  
  if (userError || !user) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-64 text-red-600">
          Unable to load user context. Please log in again.
        </div>
      </Dashboard>
    );
  }

  // For regular users, require tenantId; for super admins and admins, allow without tenantId
  if (!user.isSuperAdmin && user.role !== 'super_admin' && user.role !== 'admin' && !tenantId) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-64 text-red-600">
          Tenant context required for regular users.
        </div>
      </Dashboard>
    );
  }

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/payroll/configs/${id}`);
      if (!res.ok) throw new Error("Failed to delete payroll config");
      return res.json();
    },
    onError: (error: any, id: number) => {
      // Show user-friendly message and offer force delete
      setForceDeleteId(id);
      setShowForceDeleteDialog(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/configs", tenantId] });
      toast({ title: "Payroll configuration deleted" });
    },
  });

  // Force delete mutation
  const forceDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/payroll/configs/${id}?force=true`);
      if (!res.ok) throw new Error("Failed to force delete payroll config");
      return res.json();
    },
    onSuccess: () => {
      setShowForceDeleteDialog(false);
      setForceDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/configs", tenantId] });
      toast({ title: "Payroll configuration and related records deleted" });
    },
    onError: () => {
      toast({ title: "Failed to force delete payroll config", variant: "destructive" });
    }
  });

  // Fetch employees - tenant-aware
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees", tenantId],
    queryFn: () => apiRequest("GET", `/api/employees`).then(res => res.json()),
    enabled: !!user && (!!tenantId || user.isSuperAdmin || user.role === 'super_admin' || user.role === 'admin'),
  });

  // Fetch payroll configurations - allow super admins without tenantId
  const { data: payrollConfigs = [], isLoading: configsLoading } = useQuery<any[]>({
    queryKey: ["/api/payroll/configs", tenantId],
    queryFn: () => apiRequest("GET", `/api/payroll/configs`).then(res => res.json()),
    enabled: !!user && (Boolean(tenantId) || user.isSuperAdmin || user.role === 'super_admin' || user.role === 'admin'),
  });

  // Fetch payroll summary - allow super admins without tenantId
  const { data: payrollSummary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ["/api/payroll/summary", tenantId],
    queryFn: () => apiRequest("GET", `/api/payroll/summary`).then(res => res.json()),
    enabled: !!user && (Boolean(tenantId) || user.isSuperAdmin || user.role === 'super_admin' || user.role === 'admin'),
  });

  // Fetch payroll records - allow super admins without tenantId
  const { data: payrollRecords = [], isLoading: recordsLoading, error: recordsError } = useQuery<any[]>({
    queryKey: ["/api/payroll/records", tenantId],
    queryFn: () => apiRequest("GET", `/api/payroll/records`).then(res => res.json()),
    enabled: !!user && (Boolean(tenantId) || user.isSuperAdmin || user.role === 'super_admin' || user.role === 'admin'),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(num || 0);
  };

  const formatPeriod = (period: string) => {
    const periods: Record<string, string> = {
      monthly: "Monthly",
      bi_weekly: "Bi-weekly",
      weekly: "Weekly",
    };
    return periods[period] || period;
  };

  const openConfigForm = (config?: any) => {
    setSelectedConfig(config || null);
    setShowConfigForm(true);
  };

  const openConfigDetails = (config: any) => {
    setSelectedConfig(config);
    setSelectedRecord(null);
    setDetailsMode("config");
    setShowDetailsSheet(true);
  };

  const openRecordDetails = (record: any) => {
    setSelectedRecord(record);
    setSelectedConfig(null);
    setDetailsMode("record");
    setShowDetailsSheet(true);
  };

  const closeDetailsSheet = () => {
    setShowDetailsSheet(false);
    setDetailsMode(null);
    setSelectedConfig(null);
    setSelectedRecord(null);
  };

  // Helper to deduplicate payroll records by employeeId + payPeriodStart + payPeriodEnd
  function getUniquePayrollRecords(records: any[] = []) {
    const seen = new Set();
    return records.filter(rec => {
      const key = `${rec.employeeId}-${rec.payPeriodStart}-${rec.payPeriodEnd}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const totalConfigPages = Math.max(1, Math.ceil(payrollConfigs.length / PAYROLL_CONFIG_PAGE_SIZE));
  const currentConfigPage = Math.min(configPage, totalConfigPages);
  const paginatedPayrollConfigs = paginateItems(payrollConfigs, currentConfigPage, PAYROLL_CONFIG_PAGE_SIZE);

  const activeConfigs = payrollConfigs.filter((config: any) => config.isActive);

  const isConfigProcessed = (config: any) =>
    isPayrollProcessedForPeriod(config.employeeId, payrollRecords, payPeriodStart, payPeriodEnd);

  const processedCellClass = "opacity-50 text-muted-foreground font-normal select-none";

  const toggleConfigSelection = (configId: number, checked: boolean) => {
    setSelectedConfigIds((prev) =>
      checked ? [...prev, configId] : prev.filter((id) => id !== configId)
    );
  };

  const openPayslipModal = (config: any) => {
    const year = new Date().getFullYear();
    const availableMonths = getProcessedMonthsForEmployee(
      config.employeeId,
      year,
      payrollRecords
    );
    const currentMonth = new Date().getMonth() + 1;

    setPayslipConfig(config);
    setPayslipYear(year);
    setSelectedPayslipMonths(
      availableMonths.includes(currentMonth) ? [currentMonth] : availableMonths.slice(0, 1)
    );
    setPayslipModalOpen(true);
  };

  const payslipAvailableMonths = payslipConfig
    ? getProcessedMonthsForEmployee(payslipConfig.employeeId, payslipYear, payrollRecords)
    : [];

  const isPayslipMonthAvailable = (month: number) => payslipAvailableMonths.includes(month);

  const togglePayslipMonth = (month: number, checked: boolean) => {
    setSelectedPayslipMonths((prev) =>
      checked ? [...prev, month].sort((a, b) => a - b) : prev.filter((m) => m !== month)
    );
  };

  const handlePayslipDownload = async () => {
    if (!payslipConfig) {
      return;
    }
    if (selectedPayslipMonths.length === 0) {
      toast({
        title: "No month selected",
        description: "Please select at least one month before downloading the payslip.",
        variant: "destructive",
      });
      return;
    }

    setIsPayslipDownloading(true);

    try {
      const res = await fetch("/api/payroll/payslips/download", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payrollConfigId: payslipConfig.id,
          year: payslipYear,
          months: selectedPayslipMonths,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to download payslip" }));
        toast({
          title: "Download failed",
          description: error.message || "Failed to download payslips.",
          variant: "destructive",
        });
        return;
      }

      const employeeFirstName =
        payslipConfig.employeeName?.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z0-9]/g, "") ||
        "Employee";
      const isMultiMonth = selectedPayslipMonths.length > 1;
      const fallbackFilename = isMultiMonth
        ? `${employeeFirstName}_${payslipConfig.employeeId}_Payslips.zip`
        : buildPayslipDownloadFilename(
            payslipConfig.employeeName,
            selectedPayslipMonths[0],
            payslipYear
          );

      const result = await handlePayslipDownloadResponse(res, fallbackFilename);

      if (result.ok) {
        const missingHeader = res.headers.get("X-Payslip-Missing-Months");
        toast({
          title: isMultiMonth ? "Payslips downloaded" : "Payslip downloaded",
          description: isMultiMonth
            ? `Downloaded ${selectedPayslipMonths.length} payslip(s) as a ZIP file for ${payslipConfig.employeeName}.${missingHeader ? ` Missing: ${missingHeader}.` : ""}`
            : `Downloaded payslip for ${payslipConfig.employeeName}.${missingHeader ? ` Missing: ${missingHeader}.` : ""}`,
        });
        setPayslipModalOpen(false);
      } else {
        toast({
          title: "Download failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download payslips.",
        variant: "destructive",
      });
    } finally {
      setIsPayslipDownloading(false);
    }
  };

  const handlePayslipView = async () => {
    if (!payslipConfig) {
      return;
    }
    if (selectedPayslipMonths.length !== 1) {
      toast({
        title: "Select one month",
        description: "Please select exactly one month to view the payslip.",
        variant: "destructive",
      });
      return;
    }

    setIsPayslipViewing(true);
    const month = selectedPayslipMonths[0];

    try {
      const res = await fetch("/api/payroll/payslips/view", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payrollConfigId: payslipConfig.id,
          year: payslipYear,
          month,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to view payslip" }));
        toast({
          title: "View failed",
          description: error.message || "Failed to load payslip preview.",
          variant: "destructive",
        });
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      if (!isPdfArrayBuffer(arrayBuffer)) {
        toast({
          title: "View failed",
          description: "Server did not return a valid PDF file.",
          variant: "destructive",
        });
        return;
      }

      if (payslipViewerUrl) {
        window.URL.revokeObjectURL(payslipViewerUrl);
      }

      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const objectUrl = window.URL.createObjectURL(blob);
      const monthLabel =
        PAYSLIP_MONTHS_LEFT.concat(PAYSLIP_MONTHS_RIGHT).find((m) => m.value === month)?.label ||
        String(month);

      setPayslipViewerTitle(
        `${payslipConfig.employeeName} — ${monthLabel} ${payslipYear}`
      );
      setPayslipViewerUrl(objectUrl);
      setPayslipViewerOpen(true);
      setPayslipModalOpen(false);
    } catch (error) {
      toast({
        title: "View failed",
        description: error instanceof Error ? error.message : "Failed to load payslip preview.",
        variant: "destructive",
      });
    } finally {
      setIsPayslipViewing(false);
    }
  };

  const handleBatchProcess = async () => {
    const targetConfigs =
      selectedConfigIds.length > 0
        ? payrollConfigs.filter((c: any) => selectedConfigIds.includes(c.id))
        : activeConfigs;

    const configsToProcess = targetConfigs.filter((config: any) => config.isActive);

    if (configsToProcess.length === 0) {
      toast({
        title: "No eligible employees",
        description: "Select at least one active payroll configuration to process.",
        variant: "destructive",
      });
      return;
    }

    setIsBatchProcessing(true);
    let successCount = 0;
    const failures: string[] = [];

    for (const config of configsToProcess) {
      const employee = employees?.find((emp: any) => emp.id === config.employeeId);
      if (!employee) {
        failures.push(`${config.employeeName || config.employeeId}: employee not found`);
        continue;
      }

      try {
        await processPayrollForConfig(config, employee, payPeriodStart, payPeriodEnd);
        successCount++;
      } catch (error: any) {
        failures.push(`${config.employeeName || config.employeeId}: ${error?.message || "Failed"}`);
      }
    }

    setIsBatchProcessing(false);
    setSelectedConfigIds([]);
    queryClient.invalidateQueries({ queryKey: ["/api/payroll/records", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary", tenantId] });

    if (failures.length === 0) {
      toast({
        title: "Batch payroll processed",
        description: `${successCount} employee(s) processed for ${payPeriodStart} to ${payPeriodEnd}.`,
      });
    } else {
      toast({
        title: "Batch payroll partially complete",
        description: `${successCount} succeeded, ${failures.length} failed. ${failures.slice(0, 2).join("; ")}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dashboard>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <p className="text-muted-foreground">
            Manage employee payroll configurations and process monthly payroll
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => openConfigForm()}
            className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payroll Config
          </Button>
          <Button
            onClick={() => setShowRecordForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Summary Cards - Vendor Dashboard Style */}
      {!summaryLoading && payrollSummary && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer" onClick={() => setOpenDetail("employees")}> {/* Total Employees */}
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-teal-400 to-teal-600">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Employees</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900">{payrollSummary.totalEmployees}</p>
              <p className="text-xs text-muted-foreground mt-1">Active payroll configurations</p>
          </CardContent>
        </Card>
          <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer" onClick={() => setOpenDetail("gross")}> {/* Total Gross Pay */}
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-teal-500 to-teal-700">
                <DollarSign className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Gross Pay</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(payrollSummary.totalGrossPay)}</p>
              <p className="text-xs text-muted-foreground mt-1">{getUniquePayrollRecords(payrollRecords)?.length || 0} records</p>
              <p className="text-xs text-muted-foreground">Before deductions</p>
          </CardContent>
        </Card>
          <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer" onClick={() => setOpenDetail("net")}> {/* Total Net Pay */}
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-teal-600 to-teal-800">
                <DollarSign className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Net Pay</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(payrollSummary.totalNetPay)}</p>
              <p className="text-xs text-muted-foreground mt-1">{getUniquePayrollRecords(payrollRecords)?.length || 0} records</p>
              <p className="text-xs text-muted-foreground">After deductions</p>
          </CardContent>
        </Card>
          <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer" onClick={() => setOpenDetail("records")}>
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-orange-400 to-orange-600">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">No. of Payroll Records</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900">{getUniquePayrollRecords(payrollRecords)?.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Total processed payroll records</p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Employee Payroll Configurations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Payroll Configurations</CardTitle>
          {payrollConfigs?.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchProcess}
                disabled={isBatchProcessing || activeConfigs.length === 0}
              >
                {isBatchProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Batch Process
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPayrollConfigsToExcel(payrollConfigs)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {configsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <div className="text-muted-foreground">Loading payroll configurations...</div>
            </div>
          ) : !payrollConfigs?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payroll Configurations</h3>
              <p className="text-muted-foreground mb-4">
                Set up payroll configurations for your employees to start processing payroll.
              </p>
              <Button onClick={() => openConfigForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Configuration
              </Button>
            </div>
          ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      activeConfigs.length > 0 &&
                      activeConfigs.every((c: any) => selectedConfigIds.includes(c.id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedConfigIds(activeConfigs.map((c: any) => c.id));
                      } else {
                        setSelectedConfigIds([]);
                      }
                    }}
                    disabled={activeConfigs.length === 0 || isBatchProcessing}
                    aria-label="Select all active employees"
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Payroll Period</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Annual Salary</TableHead>
                <TableHead>CPF Rate (Employee)</TableHead>
                <TableHead>CPF Amount (Employee)</TableHead>
                <TableHead>CPF Rate (Employer)</TableHead>
                <TableHead>CPF Amount (Employer)</TableHead>
                <TableHead>Payslip</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedPayrollConfigs.map((config: any) => {
                  const processed = isConfigProcessed(config);
                  return (
                <TableRow
                  key={config.id}
                  className={processed ? "bg-muted/40" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedConfigIds.includes(config.id)}
                      onCheckedChange={(checked) =>
                        toggleConfigSelection(config.id, checked === true)
                      }
                      disabled={!config.isActive || isBatchProcessing}
                      aria-label={`Select ${config.employeeName}`}
                    />
                  </TableCell>
                  <TableCell className={processed ? processedCellClass : undefined}>
                    <div>
                      <div className={processed ? "font-normal" : "font-medium"}>{config.employeeName}</div>
                      <div className={`text-sm ${processed ? "text-muted-foreground" : "text-muted-foreground"}`}>
                        ID: {config.employeeId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={processed ? processedCellClass : undefined}>{config.department}</TableCell>
                  <TableCell className={processed ? processedCellClass : undefined}>{config.designation || '-'}</TableCell>
                  <TableCell className={processed ? `${processedCellClass} capitalize` : "capitalize"}>{(config.payrollPeriod || 'monthly').replace('_', ' ')}</TableCell>
                  <TableCell className={processed ? processedCellClass : undefined}>{formatCurrency(config.baseSalary)}</TableCell>
                  <TableCell className={processed ? processedCellClass : undefined}>{formatCurrency(parseFloat(config.baseSalary || 0) * 12)}</TableCell>
                  <TableCell className={processed ? processedCellClass : undefined}>
                    {config.nationality === 'foreigner'
                      ? '—'
                      : `${parseFloat(config.cpfRate || 0).toFixed(2)}%`}
                  </TableCell>
                  <TableCell className={processed ? processedCellClass : undefined}>{formatCurrency(config.cpfAmount || 0)}</TableCell>
                  <TableCell className={processed ? processedCellClass : undefined}>
                    {config.nationality === 'foreigner'
                      ? '—'
                      : `${parseFloat(config.employerCpfRate || 0).toFixed(2)}%`}
                  </TableCell>
                  <TableCell className={processed ? processedCellClass : undefined}>{formatCurrency(config.employerCpfAmount || 0)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                      onClick={() => openPayslipModal(config)}
                      aria-label={`Download payslip for ${config.employeeName}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <TableRowActions
                      actions={[
                        {
                          icon: Edit,
                          label: "Edit",
                          variant: "edit",
                          onClick: () => openConfigForm(config),
                        },
                        {
                          icon: Eye,
                          label: "View",
                          variant: "view",
                          onClick: () => openConfigDetails(config),
                        },
                        {
                          icon: Trash2,
                          label: "Delete",
                          variant: "delete",
                          disabled: deleteMutation.status === "pending",
                          onClick: () => {
                            if (window.confirm("Are you sure you want to delete this payroll configuration?")) {
                              deleteMutation.mutate(config.id);
                            }
                          },
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
          <TablePagination
            page={currentConfigPage}
            pageSize={PAYROLL_CONFIG_PAGE_SIZE}
            totalItems={payrollConfigs.length}
            onPageChange={setConfigPage}
          />
          </>
          )}
        </CardContent>
      </Card>

      {/* Payroll Configuration Settings */}
      {/* <Card className="mt-6">
        <CardHeader>
          <CardTitle>Payroll Configuration Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Default Tax Rate</h4>
              <p className="text-2xl font-bold text-green-600">10.00%</p>
              <p className="text-xs text-muted-foreground">Standard tax rate for all employees</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Default CPF Rate</h4>
              <p className="text-2xl font-bold text-blue-600">20.00%</p>
              <p className="text-xs text-muted-foreground">Central Provident Fund contribution rate</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Payroll Period</h4>
              <p className="text-2xl font-bold text-purple-600">Monthly</p>
              <p className="text-xs text-muted-foreground">Default payroll processing frequency</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Overtime Rate</h4>
              <p className="text-2xl font-bold text-orange-600">1.5x</p>
              <p className="text-xs text-muted-foreground">Overtime pay multiplier</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Bonus Rate</h4>
              <p className="text-2xl font-bold text-teal-600">13th Month</p>
              <p className="text-xs text-muted-foreground">Annual bonus calculation method</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Leave Encashment</h4>
              <p className="text-2xl font-bold text-red-600">Enabled</p>
              <p className="text-xs text-muted-foreground">Unused leave payment option</p>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Right-side Slider for Payroll Config Form */}
      <Sheet open={showConfigForm} onOpenChange={(open) => {
        setShowConfigForm(open);
        if (!open) setSelectedConfig(null);
      }}>
        <SheetContent 
          side="right" 
          className="p-0 flex flex-col"
          style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-gray-900">
                {selectedConfig ? "Edit Payroll Configuration" : "Add Payroll Configuration"}
              </SheetTitle>
              <p className="text-sm text-gray-600 mt-2">
                Configure payroll settings for an employee
              </p>
            </SheetHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-24">
            <PayrollConfigForm
              onSuccess={() => {
                setShowConfigForm(false);
                setSelectedConfig(null);
                queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
              }}
              onCancel={() => {
                setShowConfigForm(false);
                setSelectedConfig(null);
              }}
              editData={selectedConfig}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Right-side Slider for Payroll Record Form */}
      <Sheet open={showRecordForm} onOpenChange={setShowRecordForm}>
        <SheetContent 
          side="right" 
          className="p-0 flex flex-col"
          style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-gray-900">
                Generate Payroll Records
              </SheetTitle>
              <p className="text-sm text-gray-600 mt-2">
                Create and process monthly payroll for employees
              </p>
            </SheetHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-24">
            <ProcessPayrollForm
              onSuccess={() => setShowRecordForm(false)}
              onCancel={() => setShowRecordForm(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* View Details Sheet */}
      <EntityViewSheet
        open={showDetailsSheet}
        onOpenChange={(open) => !open && closeDetailsSheet()}
        title={
          detailsMode === "config"
            ? "Payroll Configuration Details"
            : "Payroll Record Details"
        }
        description={
          detailsMode === "config"
            ? "View complete payroll configuration information"
            : "View complete payroll record information"
        }
        onClose={closeDetailsSheet}
      >
        {detailsMode === "config" && selectedConfig && (
          <>
            <EntityViewSection title="Employee Information">
              <EntityViewFieldGrid>
                <EntityViewField label="Employee Name" value={selectedConfig.employeeName} />
                <EntityViewField label="Employee ID" value={selectedConfig.employeeId} />
                <EntityViewField label="Department" value={selectedConfig.department} />
                <EntityViewField label="Designation" value={formatViewValue(selectedConfig.designation)} />
                <EntityViewField
                  label="Date of Birth"
                  value={formatViewDate(selectedConfig.dateOfBirth)}
                />
                <EntityViewField
                  label="Nationality"
                  value={formatViewStatus(selectedConfig.nationality)}
                />
              </EntityViewFieldGrid>
            </EntityViewSection>

            <EntityViewSection title="Salary & CPF Details">
              <EntityViewFieldGrid>
                <EntityViewField
                  label="Annual Salary"
                  value={
                    selectedConfig.annualSalary
                      ? formatCurrency(selectedConfig.annualSalary)
                      : formatCurrency(parseFloat(selectedConfig.baseSalary || 0) * 12)
                  }
                />
                <EntityViewField
                  label="Monthly Base Salary"
                  value={formatCurrency(selectedConfig.baseSalary)}
                />
                <EntityViewField label="Net Salary" value={formatCurrency(selectedConfig.netSalary || 0)} />
                <EntityViewField
                  label="CPF Rate (Employee)"
                  value={
                    selectedConfig.nationality?.trim().toLowerCase() === "foreigner"
                      ? "Not Applicable (Foreigner)"
                      : `${parseFloat(selectedConfig.cpfRate || 0).toFixed(2)}%`
                  }
                />
                <EntityViewField
                  label="CPF Amount (Employee)"
                  value={formatCurrency(selectedConfig.cpfAmount || 0)}
                />
                <EntityViewField
                  label="CPF Rate (Employer)"
                  value={
                    selectedConfig.employerCpfRate
                      ? `${selectedConfig.employerCpfRate}%`
                      : "—"
                  }
                />
                <EntityViewField
                  label="CPF Amount (Employer)"
                  value={formatCurrency(selectedConfig.employerCpfAmount || 0)}
                />
              </EntityViewFieldGrid>
            </EntityViewSection>

            <EntityViewSection title="Configuration Details">
              <EntityViewFieldGrid>
                <EntityViewField
                  label="Status"
                  value={selectedConfig.isActive ? "Active" : "Inactive"}
                />
                <EntityViewField
                  label="Effective From"
                  value={formatViewValue(selectedConfig.effectiveFrom)}
                />
                <EntityViewField
                  label="Payroll Period"
                  value={formatViewStatus(selectedConfig.payrollPeriod)}
                />
                <EntityViewField
                  label="No of Working Days"
                  value={selectedConfig.noOfWorkingDays != null ? String(selectedConfig.noOfWorkingDays) : "—"}
                />
                <EntityViewField label="Internal ID" value={String(selectedConfig.id)} />
              </EntityViewFieldGrid>
            </EntityViewSection>
          </>
        )}

        {detailsMode === "record" && selectedRecord && (
          <>
            <EntityViewSection title="Employee Information">
              <EntityViewFieldGrid>
                <EntityViewField label="Employee Name" value={selectedRecord.employeeName} />
                <EntityViewField label="Department" value={selectedRecord.department} />
                <EntityViewField label="Designation" value={selectedRecord.designation} />
              </EntityViewFieldGrid>
            </EntityViewSection>

            <EntityViewSection title="Payroll Details">
              <EntityViewFieldGrid>
                <EntityViewField
                  label="Pay Period Start"
                  value={formatViewValue(selectedRecord.payPeriodStart)}
                />
                <EntityViewField
                  label="Pay Period End"
                  value={formatViewValue(selectedRecord.payPeriodEnd)}
                />
                <EntityViewField label="Gross Pay" value={formatCurrency(selectedRecord.grossPay)} />
                <EntityViewField
                  label="CPF Deduction"
                  value={formatCurrency(selectedRecord.cpfDeduction)}
                />
                <EntityViewField label="Net Pay" value={formatCurrency(selectedRecord.netPay)} />
                <EntityViewField label="Status" value={formatViewStatus(selectedRecord.status)} />
                <EntityViewField
                  label="Notes"
                  value={formatViewValue(selectedRecord.notes)}
                  fullWidth
                />
                <EntityViewField label="Internal ID" value={String(selectedRecord.id)} />
              </EntityViewFieldGrid>
            </EntityViewSection>
          </>
        )}
      </EntityViewSheet>

      {/* Detail Sheet for Summary Cards */}
      <Sheet open={!!openDetail} onOpenChange={open => !open && setOpenDetail(null)}>
        <SheetContent side="right" className="p-0 flex flex-col" style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}>
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-3xl font-extrabold text-gray-900 mb-2">
                {openDetail === "employees" && "Employees with Payroll Configurations"}
                {openDetail === "gross" && "Payroll Records - Gross Pay"}
                {openDetail === "net" && "Payroll Records - Net Pay"}
                {openDetail === "records" && "Payroll Records"}
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-24">
            {/* Employees with Payroll Configs */}
            {openDetail === "employees" && (
              employeesLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading employees...</div>
              ) : employees?.length ? (
                <ul className="divide-y">
                  {employees.map((emp: any) => (
                    <li key={emp.id} className="py-3">
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.department} | {emp.designation}</div>
                    </li>
                  ))}
                </ul>
              ) : <div className="py-8 text-center text-muted-foreground">No employees found.</div>
            )}
            {/* Payroll Records - Gross Pay */}
            {openDetail === "gross" && (
              recordsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading payroll records...</div>
              ) : recordsError ? (
                <div className="py-8 text-center text-red-600">Failed to load payroll records.</div>
              ) : payrollRecords?.length ? (
                <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left font-semibold">Employee</th>
                      <th className="px-4 py-2 text-left font-semibold">Period</th>
                      <th className="px-4 py-2 text-left font-semibold">Gross Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getUniquePayrollRecords(payrollRecords).map((rec: any) => (
                      <tr key={`${rec.employeeId}-${rec.payPeriodStart}-${rec.payPeriodEnd}`} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{rec.employeeName}</td>
                        <td className="px-4 py-2">{rec.payPeriodStart} - {rec.payPeriodEnd}</td>
                        <td className="px-4 py-2">{formatCurrency(rec.grossPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="py-8 text-center text-muted-foreground">No payroll records found.</div>
            )}
            {/* Payroll Records - Net Pay */}
            {openDetail === "net" && (
              recordsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading payroll records...</div>
              ) : recordsError ? (
                <div className="py-8 text-center text-red-600">Failed to load payroll records.</div>
              ) : payrollRecords?.length ? (
                <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left font-semibold">Employee</th>
                      <th className="px-4 py-2 text-left font-semibold">Period</th>
                      <th className="px-4 py-2 text-left font-semibold">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getUniquePayrollRecords(payrollRecords).map((rec: any) => (
                      <tr key={`${rec.employeeId}-${rec.payPeriodStart}-${rec.payPeriodEnd}`} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{rec.employeeName}</td>
                        <td className="px-4 py-2">{rec.payPeriodStart} - {rec.payPeriodEnd}</td>
                        <td className="px-4 py-2">{formatCurrency(rec.netPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="py-8 text-center text-muted-foreground">No payroll records found.</div>
            )}
            {/* All Payroll Records */}
            {openDetail === "records" && (
              recordsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading payroll records...</div>
              ) : recordsError ? (
                <div className="py-8 text-center text-red-600">Failed to load payroll records.</div>
              ) : payrollRecords?.length ? (
                <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left font-semibold">Employee</th>
                      <th className="px-4 py-2 text-left font-semibold">Period</th>
                      <th className="px-4 py-2 text-left font-semibold">Status</th>
                      <th className="px-4 py-2 text-left font-semibold">Gross Pay</th>
                      <th className="px-4 py-2 text-left font-semibold">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getUniquePayrollRecords(payrollRecords).map((rec: any) => (
                      <tr key={`${rec.employeeId}-${rec.payPeriodStart}-${rec.payPeriodEnd}`} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{rec.employeeName}</td>
                        <td className="px-4 py-2">{rec.payPeriodStart} - {rec.payPeriodEnd}</td>
                        <td className="px-4 py-2">{rec.status}</td>
                        <td className="px-4 py-2">{formatCurrency(rec.grossPay)}</td>
                        <td className="px-4 py-2">{formatCurrency(rec.netPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="py-8 text-center text-muted-foreground">No payroll records found.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Payslip Download Dialog */}
      <Dialog open={payslipModalOpen} onOpenChange={setPayslipModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payslip</DialogTitle>
          </DialogHeader>
          {payslipConfig && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select one or more months for{" "}
                <span className="font-medium text-foreground">{payslipConfig.employeeName}</span>{" "}
                (ID: {payslipConfig.employeeId}). Payslips use processed payroll data only — process
                payroll for the selected month(s) before downloading.
              </p>
              <div className="flex items-center gap-3">
                <label htmlFor="payslip-year" className="text-sm font-medium">
                  Year
                </label>
                <input
                  id="payslip-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={payslipYear}
                  onChange={(e) => {
                    const nextYear = parseInt(e.target.value, 10) || new Date().getFullYear();
                    setPayslipYear(nextYear);
                    if (payslipConfig) {
                      const available = getProcessedMonthsForEmployee(
                        payslipConfig.employeeId,
                        nextYear,
                        payrollRecords
                      );
                      setSelectedPayslipMonths((prev) =>
                        prev.filter((m) => available.includes(m))
                      );
                    }
                  }}
                  className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              {payslipAvailableMonths.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                  No processed payroll is available for this employee in {payslipYear}. Please process
                  payroll first, then return to download the payslip.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Available months (processed payroll):{" "}
                  {payslipAvailableMonths
                    .map(
                      (m) =>
                        PAYSLIP_MONTHS_LEFT.concat(PAYSLIP_MONTHS_RIGHT).find((x) => x.value === m)
                          ?.label
                    )
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  {PAYSLIP_MONTHS_LEFT.map((month) => {
                    const available = isPayslipMonthAvailable(month.value);
                    return (
                    <label
                      key={month.value}
                      className={`flex items-center gap-2 text-sm ${available ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                    >
                      <Checkbox
                        checked={selectedPayslipMonths.includes(month.value)}
                        disabled={!available}
                        onCheckedChange={(checked) =>
                          available && togglePayslipMonth(month.value, checked === true)
                        }
                      />
                      {month.label}
                    </label>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  {PAYSLIP_MONTHS_RIGHT.map((month) => {
                    const available = isPayslipMonthAvailable(month.value);
                    return (
                    <label
                      key={month.value}
                      className={`flex items-center gap-2 text-sm ${available ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                    >
                      <Checkbox
                        checked={selectedPayslipMonths.includes(month.value)}
                        disabled={!available}
                        onCheckedChange={(checked) =>
                          available && togglePayslipMonth(month.value, checked === true)
                        }
                      />
                      {month.label}
                    </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPayslipModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handlePayslipView}
              disabled={
                isPayslipViewing ||
                isPayslipDownloading ||
                selectedPayslipMonths.length !== 1 ||
                payslipAvailableMonths.length === 0
              }
            >
              {isPayslipViewing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  View Payslip
                </>
              )}
            </Button>
            <Button
              onClick={handlePayslipDownload}
              disabled={
                isPayslipDownloading ||
                isPayslipViewing ||
                selectedPayslipMonths.length === 0 ||
                payslipAvailableMonths.length === 0
              }
            >
              {isPayslipDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payslip PDF Viewer */}
      <Dialog
        open={payslipViewerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePayslipViewer(payslipViewerUrl, setPayslipViewerOpen, setPayslipViewerUrl);
          } else {
            setPayslipViewerOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>{payslipViewerTitle || "Payslip Preview"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted/30">
            {payslipViewerUrl ? (
              <iframe
                src={payslipViewerUrl}
                title="Payslip preview"
                className="w-full h-full min-h-[70vh] border-0 bg-white"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading payslip...
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-3 border-t shrink-0">
            <Button
              variant="outline"
              onClick={() =>
                closePayslipViewer(payslipViewerUrl, setPayslipViewerOpen, setPayslipViewerUrl)
              }
            >
              Close
            </Button>
            {payslipViewerUrl && (
              <Button onClick={() => window.open(payslipViewerUrl, "_blank", "noopener,noreferrer")}>
                Open in New Tab
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force Delete Dialog */}
      <Dialog open={showForceDeleteDialog} onOpenChange={setShowForceDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Delete Payroll Configuration</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            This payroll configuration has related payroll records. Do you want to delete all related records and the configuration?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForceDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (forceDeleteId) forceDeleteMutation.mutate(forceDeleteId);
              }}
              disabled={forceDeleteMutation.status === 'pending'}
            >
              Delete AnyWay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Dashboard>
  );
}
