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
// Temporarily removed form imports until components are created

interface PayrollConfig {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail: string;
  department: string;
  designation: string;
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
  employeeEmail: string;
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

  // Fetch payroll summary
  const { data: summary, isLoading: summaryLoading } = useQuery<PayrollSummary>({
    queryKey: ["/api/payroll/summary"],
  });

  // Fetch payroll configurations
  const { data: configs, isLoading: configsLoading } = useQuery<PayrollConfig[]>({
    queryKey: ["/api/payroll/configs"],
  });

  // Fetch payroll records
  const { data: records, isLoading: recordsLoading } = useQuery<PayrollRecord[]>({
    queryKey: ["/api/payroll/records"],
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
      draft: "text-gray-600",
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

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <p className="text-muted-foreground">
            Manage employee payroll configurations and process monthly payments
          </p>
        </div>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalEmployees}</div>
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
              <div className="text-2xl font-bold">{formatCurrency(summary.totalGrossPay)}</div>
              <p className="text-xs text-muted-foreground">
                Before deductions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Net Pay</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalNetPay)}</div>
              <p className="text-xs text-muted-foreground">
                After deductions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Records</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pendingRecords}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting approval
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="configs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configs">Payroll Configurations</TabsTrigger>
          <TabsTrigger value="records">Payroll Records</TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Payroll Configurations</CardTitle>
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
                        <TableCell>{config.taxRate}%</TableCell>
                        <TableCell>{config.cpfRate}%</TableCell>
                        <TableCell>
                          <Badge variant={config.isActive ? "default" : "secondary"}>
                            {config.isActive ? "Active" : "Inactive"}
                          </Badge>
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
                            Tax: {formatCurrency(record.taxDeduction)}<br />
                            CPF: {formatCurrency(record.cpfDeduction)}
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
                              onClick={() => openRecordForm(record)}
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

      {/* Forms */}
      <PayrollConfigForm
        isOpen={configFormOpen}
        onClose={() => {
          setConfigFormOpen(false);
          setSelectedConfig(null);
        }}
        config={selectedConfig}
      />

      <PayrollRecordForm
        isOpen={recordFormOpen}
        onClose={() => {
          setRecordFormOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
      />
    </div>
  );
}