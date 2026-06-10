import { useState } from "react";
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
  isPayrollProcessedForPeriod,
  processPayrollForConfig,
} from "@/lib/payroll-batch-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TableRowActions } from "@/components/ui/table-row-actions";
import { TablePagination, paginateItems } from "@/components/ui/table-pagination";
import { Checkbox } from "@/components/ui/checkbox";

const PAYROLL_CONFIG_PAGE_SIZE = 10;

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

  const isConfigProcessed = (config: any) =>
    isPayrollProcessedForPeriod(config.employeeId, payrollRecords, payPeriodStart, payPeriodEnd);

  const eligibleConfigs = payrollConfigs.filter(
    (config: any) => config.isActive && !isConfigProcessed(config)
  );

  const toggleConfigSelection = (configId: number, checked: boolean) => {
    setSelectedConfigIds((prev) =>
      checked ? [...prev, configId] : prev.filter((id) => id !== configId)
    );
  };

  const handleBatchProcess = async () => {
    const targetConfigs =
      selectedConfigIds.length > 0
        ? payrollConfigs.filter((c: any) => selectedConfigIds.includes(c.id))
        : eligibleConfigs;

    const configsToProcess = targetConfigs.filter(
      (config: any) => config.isActive && !isConfigProcessed(config)
    );

    if (configsToProcess.length === 0) {
      toast({
        title: "No eligible employees",
        description: "All selected employees already have payroll processed for this period.",
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
                disabled={isBatchProcessing || eligibleConfigs.length === 0}
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
                      eligibleConfigs.length > 0 &&
                      eligibleConfigs.every((c: any) => selectedConfigIds.includes(c.id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedConfigIds(eligibleConfigs.map((c: any) => c.id));
                      } else {
                        setSelectedConfigIds([]);
                      }
                    }}
                    disabled={eligibleConfigs.length === 0}
                    aria-label="Select all eligible employees"
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Annual Salary</TableHead>
                <TableHead>CPF Rate (Employee)</TableHead>
                <TableHead>CPF Amount (Employee)</TableHead>
                <TableHead>CPF Rate (Employer)</TableHead>
                <TableHead>CPF Amount (Employer)</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedPayrollConfigs.map((config: any) => {
                  const processed = isConfigProcessed(config);
                  return (
                <TableRow
                  key={config.id}
                  className={processed ? "bg-blue-50 hover:bg-blue-100" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedConfigIds.includes(config.id)}
                      onCheckedChange={(checked) =>
                        toggleConfigSelection(config.id, checked === true)
                      }
                      disabled={processed || !config.isActive || isBatchProcessing}
                      aria-label={`Select ${config.employeeName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{config.employeeName}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {config.employeeId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{config.department}</TableCell>
                  <TableCell>{config.designation || '-'}</TableCell>
                  <TableCell>{formatCurrency(config.baseSalary)}</TableCell>
                  <TableCell>{formatCurrency(parseFloat(config.baseSalary || 0) * 12)}</TableCell>
                  <TableCell>
                    {config.nationality === 'foreigner'
                      ? '—'
                      : `${parseFloat(config.cpfRate || 0).toFixed(2)}%`}
                  </TableCell>
                  <TableCell>{formatCurrency(config.cpfAmount || 0)}</TableCell>
                  <TableCell>
                    {config.nationality === 'foreigner'
                      ? '—'
                      : `${parseFloat(config.employerCpfRate || 0).toFixed(2)}%`}
                  </TableCell>
                  <TableCell>{formatCurrency(config.employerCpfAmount || 0)}</TableCell>
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
      <Sheet open={showDetailsSheet} onOpenChange={(open) => !open && closeDetailsSheet()}>
        <SheetContent side="right" className="p-0 flex flex-col" style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}>
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-gray-900">
                {detailsMode === "config" ? "Payroll Configuration Details" : "Payroll Record Details"}
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {detailsMode === "config" && selectedConfig && (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedConfig.employeeName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><span className="font-medium">Employee ID:</span> {selectedConfig.employeeId}</div>
                  <div><span className="font-medium">Department:</span> {selectedConfig.department}</div>
                  <div><span className="font-medium">Designation:</span> {selectedConfig.designation || '-'}</div>
                  <div><span className="font-medium">Date of Birth:</span> {selectedConfig.dateOfBirth ? new Date(selectedConfig.dateOfBirth).toLocaleDateString('en-GB') : '-'}</div>
                  <div><span className="font-medium">Annual Salary:</span> {selectedConfig.annualSalary ? formatCurrency(selectedConfig.annualSalary) : '-'}</div>
                  <div><span className="font-medium">Monthly Base Salary:</span> {formatCurrency(selectedConfig.baseSalary)}</div>
                  <div>
                    <span className="font-medium">CPF Rate:</span>{" "}
                    {selectedConfig.nationality && selectedConfig.nationality.trim().toLowerCase() === 'foreigner'
                      ? 'Not Applicable (Foreigner)'
                      : `${parseFloat(selectedConfig.cpfRate || 0).toFixed(2)}%`}
                  </div>
                  <div><span className="font-medium">CPF Amount (Employee):</span> {formatCurrency(selectedConfig.cpfAmount || 0)}</div>
                  <div><span className="font-medium">CPF Rate (Employer):</span> {selectedConfig.employerCpfRate ? `${selectedConfig.employerCpfRate}%` : '—'}</div>
                  <div><span className="font-medium">CPF Amount (Employer):</span> {formatCurrency(selectedConfig.employerCpfAmount || 0)}</div>
                  <div><span className="font-medium">Net Salary:</span> {formatCurrency(selectedConfig.netSalary || 0)}</div>
                  <div><span className="font-medium">Status:</span> {selectedConfig.isActive ? "Active" : "Inactive"}</div>
                  <div><span className="font-medium">Effective From:</span> {selectedConfig.effectiveFrom}</div>
                </CardContent>
              </Card>
            )}

            {detailsMode === "record" && selectedRecord && (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedRecord.employeeName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><span className="font-medium">Department:</span> {selectedRecord.department}</div>
                  <div><span className="font-medium">Designation:</span> {selectedRecord.designation}</div>
                  <div><span className="font-medium">Pay Period:</span> {selectedRecord.payPeriodStart} - {selectedRecord.payPeriodEnd}</div>
                  <div><span className="font-medium">Gross Pay:</span> {formatCurrency(selectedRecord.grossPay)}</div>
                  <div><span className="font-medium">CPF Deduction:</span> {formatCurrency(selectedRecord.cpfDeduction)}</div>
                  <div><span className="font-medium">Net Pay:</span> {formatCurrency(selectedRecord.netPay)}</div>
                  <div><span className="font-medium">Status:</span> {selectedRecord.status}</div>
                  <div><span className="font-medium">Notes:</span> {selectedRecord.notes || "No notes"}</div>
                </CardContent>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
