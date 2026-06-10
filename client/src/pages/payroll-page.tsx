import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Plus,
  Users,
  DollarSign,
  Calculator,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { formatTaxRate, formatCpfRate, isEmployeeCpfEligible } from "@/lib/payroll-utils";
import PayrollConfigForm from "@/components/forms/PayrollConfigForm";
import ProcessPayrollForm from "@/components/forms/ProcessPayrollForm";
import Dashboard from "@/components/layout/Dashboard";

interface PayrollConfig {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail?: string;
  department: string;
  designation: string;
  nationality?: string;
  baseSalary: string;
  payrollPeriod: 'monthly' | 'bi_weekly' | 'weekly';
  hourlyRate?: string;
  overtimeRate?: string;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  taxRate: string;
  cpfRate: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

interface PayrollRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail?: string;
  department: string;
  designation: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  baseSalary: string;
  overtimeHours: string;
  overtimePay: string;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  grossPay: string;
  taxDeduction: string;
  cpfDeduction: string;
  netPay: string;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'cancelled';
  paymentDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface PayrollSummary {
  totalEmployees: number;
  totalGrossPay: number;
  totalNetPay: number;
  totalTaxDeduction: number;
  totalCpfDeduction: number;
  paidRecords: number;
  pendingRecords: number;
  draftRecords: number;
}

export default function PayrollPage() {
  const [configFormOpen, setConfigFormOpen] = useState(false);
  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<PayrollConfig | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMode, setDetailMode] = useState<"config" | "record" | null>(null);

  // Get user and tenant context
  const { user, isLoading: userLoading, error: userError } = useAuth();
  const tenantId = user?.tenantId;

  // Show loading or error state for user context
  if (userLoading) {
    return <div className="flex items-center justify-center h-64">Loading user...</div>;
  }
  if (userError || !user) {
    return <div className="flex items-center justify-center h-64 text-red-600">Unable to load user context. Please log in again.</div>;
  }

  // Fetch payroll summary - tenant-aware
  const { data: summary, isLoading: summaryLoading } = useQuery<PayrollSummary>({
    queryKey: ["/api/payroll/summary", tenantId],
    queryFn: () => apiRequest("GET", `/api/payroll/summary`).then(res => res.json()),
    enabled: !!user,
  });

  // Fetch payroll configurations - tenant-aware
  const { data: configs, isLoading: configsLoading } = useQuery<PayrollConfig[]>({
    queryKey: ["/api/payroll/configs", tenantId],
    queryFn: () => apiRequest("GET", `/api/payroll/configs`).then(res => res.json()),
    enabled: !!user,
  });

  // Fetch payroll records - tenant-aware
  const { data: records, isLoading: recordsLoading } = useQuery<PayrollRecord[]>({
    queryKey: ["/api/payroll/records", tenantId],
    queryFn: () => apiRequest("GET", `/api/payroll/records`).then(res => res.json()),
    enabled: !!user,
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: "secondary",
      pending: "outline",
      approved: "default",
      paid: "default",
      cancelled: "destructive",
    };

    const colors: Record<string, string> = {
      draft: "text-muted-foreground",
      pending: "text-yellow-600",
      approved: "text-blue-600",
      paid: "text-green-600",
      cancelled: "text-red-600",
    };

    const icons: Record<string, any> = {
      draft: Edit,
      pending: Clock,
      approved: CheckCircle,
      paid: CheckCircle,
      cancelled: AlertCircle,
    };

    const Icon = icons[status];

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const openConfigForm = (config?: PayrollConfig) => {
    setSelectedConfig(config || null);
    setConfigFormOpen(true);
  };

  const openRecordForm = (record?: PayrollRecord) => {
    setSelectedRecord(record || null);
    setRecordFormOpen(true);
  };

  const openConfigDetails = (config: PayrollConfig) => {
    setSelectedConfig(config);
    setSelectedRecord(null);
    setDetailMode("config");
    setDetailOpen(true);
  };

  const openRecordDetails = (record: PayrollRecord) => {
    setSelectedRecord(record);
    setSelectedConfig(null);
    setDetailMode("record");
    setDetailOpen(true);
  };

  const closeDetails = () => {
    setDetailOpen(false);
    setDetailMode(null);
    setSelectedConfig(null);
    setSelectedRecord(null);
  };

  return (
  <Dashboard
    title={<span className="text-[32px] font-bold">Payroll Management</span>}
    description="Manage your organization's assets."
  >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button onClick={() => openConfigForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payroll Config
            </Button>
            <Button onClick={() => openRecordForm()}>
              <Calculator className="h-4 w-4 mr-2" />
              Process Payroll
            </Button>
          </div>
        </div>

      {/* Summary Cards */}
      {!summaryLoading && summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{summary.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                Active payroll configurations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gross Pay</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalGrossPay)}</div>
              <p className="text-xs text-muted-foreground">
                Before deductions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Income Tax</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalTaxDeduction)}</div>
              <p className="text-xs text-muted-foreground">
                Foreign workers only
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPF Contributions</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalCpfDeduction)}</div>
              <p className="text-xs text-muted-foreground">
                Citizens & PRs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Net Pay</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalNetPay)}</div>
              <p className="text-xs text-muted-foreground">
                After deductions
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="h-full overflow-y-auto">
        <Tabs defaultValue="configs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="configs">Payroll Configurations</TabsTrigger>
            <TabsTrigger value="records">Payroll Records</TabsTrigger>
          </TabsList>

          <TabsContent value="configs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle> Payroll Configurations</CardTitle>
            </CardHeader>
            <CardContent>
              {configsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading payroll configurations...</div>
                </div>
              ) : !configs?.length ? (
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Base Salary</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Tax Rate</TableHead>
                      <TableHead>CPF Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{config.employeeName}</div>
                            <div className="text-sm text-muted-foreground">
                              {config.designation}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{config.department}</TableCell>
                        <TableCell>{formatCurrency(config.baseSalary)}</TableCell>
                        <TableCell>{formatPeriod(config.payrollPeriod)}</TableCell>
                        <TableCell>{formatTaxRate(config.taxRate, config.nationality)}</TableCell>
                        <TableCell>
  {config.nationality === 'foreigner'
    ? '-'
    : formatCpfRate(config.cpfRate, config.nationality)}
</TableCell>                        <TableCell>
                          <Badge variant={config.isActive ? "default" : "secondary"}>
                            {config.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(config.effectiveFrom).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openConfigForm(config)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openConfigDetails(config)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Records</CardTitle>
            </CardHeader>
            <CardContent>
              {recordsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading payroll records...</div>
                </div>
              ) : !records?.length ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Payroll Records</h3>
                  <p className="text-muted-foreground mb-4">
                    Process your first payroll to see records here.
                  </p>
                  <Button onClick={() => openRecordForm()}>
                    <Calculator className="h-4 w-4 mr-2" />
                    Process First Payroll
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Pay Period</TableHead>
                      <TableHead>Gross Pay</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{record.employeeName}</div>
                            <div className="text-sm text-muted-foreground">
                              {record.designation}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(record.payPeriodStart).toLocaleDateString()} -{" "}
                            {new Date(record.payPeriodEnd).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(record.grossPay)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {parseFloat(record.taxDeduction) > 0 ? (
                              <>
                                <div className="text-red-600 font-medium">
                                  Tax: {formatCurrency(record.taxDeduction)}
                                </div>
                              </>
                            ) : (
                              <div className="text-muted-foreground text-xs">
                                Tax: Not Applicable
                              </div>
                            )}
                            {parseFloat(record.cpfDeduction) > 0 ? (
                              <div className="text-blue-600 font-medium">
                                CPF: {formatCurrency(record.cpfDeduction)}
                              </div>
                            ) : (
                              <div className="text-muted-foreground text-xs">
                                CPF: Not Applicable
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(record.netPay)}
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRecordDetails(record)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      {/* Payroll Config Form Sheet */}
      <Sheet open={configFormOpen} onOpenChange={(open) => { if (!open) { setConfigFormOpen(false); setSelectedConfig(null); } }}>
        <SheetContent
          side="right"
          className="p-0 flex flex-col"
          style={{ width: "55vw", maxWidth: "none", minWidth: "320px" }}
        >
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-gray-900">
                {selectedConfig ? "Edit Payroll Config" : "Add Payroll Config"}
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-24">
            {configFormOpen && (
              <PayrollConfigForm
                onSuccess={() => { setConfigFormOpen(false); setSelectedConfig(null); }}
                onCancel={() => { setConfigFormOpen(false); setSelectedConfig(null); }}
                editData={selectedConfig}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Process Payroll Form Sheet */}
      <Sheet open={recordFormOpen} onOpenChange={(open) => { if (!open) { setRecordFormOpen(false); setSelectedRecord(null); } }}>
        <SheetContent
          side="right"
          className="p-0 flex flex-col"
          style={{ width: "55vw", maxWidth: "none", minWidth: "320px" }}
        >
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-gray-900">
                Process Payroll
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-24">
            {recordFormOpen && (
              <ProcessPayrollForm
                onSuccess={() => { setRecordFormOpen(false); setSelectedRecord(null); }}
                onCancel={() => { setRecordFormOpen(false); setSelectedRecord(null); }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={detailOpen} onOpenChange={(open) => !open && closeDetails()}>
        <SheetContent
          side="right"
          className="p-0 flex flex-col"
          style={{ width: "42vw", maxWidth: "none", minWidth: "320px" }}
        >
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-gray-900">
                {detailMode === "record" ? "Payroll Record Details" : "Payroll Configuration Details"}
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {detailMode === "record" && selectedRecord && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{selectedRecord.employeeName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><span className="font-medium">Department:</span> {selectedRecord.department}</div>
                  <div><span className="font-medium">Designation:</span> {selectedRecord.designation}</div>
                  <div>
                    <span className="font-medium">Pay Period:</span>{" "}
                    {new Date(selectedRecord.payPeriodStart).toLocaleDateString()} - {new Date(selectedRecord.payPeriodEnd).toLocaleDateString()}
                  </div>
                  <div><span className="font-medium">Gross Pay:</span> {formatCurrency(selectedRecord.grossPay)}</div>
                  <div><span className="font-medium">Tax Deduction:</span> {formatCurrency(selectedRecord.taxDeduction)}</div>
                  <div><span className="font-medium">CPF Deduction:</span> {formatCurrency(selectedRecord.cpfDeduction)}</div>
                  <div><span className="font-medium">Net Pay:</span> {formatCurrency(selectedRecord.netPay)}</div>
                  <div><span className="font-medium">Status:</span> {selectedRecord.status}</div>
                  <div><span className="font-medium">Notes:</span> {selectedRecord.notes || "No notes"}</div>
                  <div><span className="font-medium">Created:</span> {new Date(selectedRecord.createdAt).toLocaleString()}</div>
                </CardContent>
              </Card>
            )}

            {detailMode === "config" && selectedConfig && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{selectedConfig.employeeName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><span className="font-medium">Department:</span> {selectedConfig.department}</div>
                  <div><span className="font-medium">Designation:</span> {selectedConfig.designation}</div>
                  <div><span className="font-medium">Base Salary:</span> {formatCurrency(selectedConfig.baseSalary)}</div>
                  <div><span className="font-medium">Period:</span> {formatPeriod(selectedConfig.payrollPeriod)}</div>
                  <div><span className="font-medium">Tax Rate:</span> {formatTaxRate(selectedConfig.taxRate, selectedConfig.nationality)}</div>
                  <div>
                    <span className="font-medium">CPF Rate:</span>{" "}
                    {selectedConfig.nationality === "foreigner" ? "-" : formatCpfRate(selectedConfig.cpfRate, selectedConfig.nationality)}
                  </div>
                  <div><span className="font-medium">Status:</span> {selectedConfig.isActive ? "Active" : "Inactive"}</div>
                  <div><span className="font-medium">Effective From:</span> {new Date(selectedConfig.effectiveFrom).toLocaleDateString()}</div>
                  <div>
                    <span className="font-medium">Effective To:</span>{" "}
                    {selectedConfig.effectiveTo ? new Date(selectedConfig.effectiveTo).toLocaleDateString() : "Not set"}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>

      </div>
    </Dashboard>
  );
}
