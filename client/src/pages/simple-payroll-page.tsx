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

export default function PayrollPage() {
  // Mock data for demonstration
  const mockConfigs = [
    {
      id: 1,
      employeeName: "John Doe",
      employeeEmail: "john@company.com",
      department: "Engineering",
      designation: "Senior Developer",
      baseSalary: "8000.00",
      payrollPeriod: "monthly" as const,
      taxRate: "10.00",
      cpfRate: "20.00",
      isActive: true,
    },
    {
      id: 2,
      employeeName: "Jane Smith",
      employeeEmail: "jane@company.com",
      department: "HR",
      designation: "HR Manager",
      baseSalary: "7500.00",
      payrollPeriod: "monthly" as const,
      taxRate: "10.00",
      cpfRate: "20.00",
      isActive: true,
    },
  ];

  const mockRecords = [
    {
      id: 1,
      employeeName: "John Doe",
      designation: "Senior Developer",
      payPeriodStart: "2025-01-01",
      payPeriodEnd: "2025-01-31",
      grossPay: "8000.00",
      taxDeduction: "800.00",
      cpfDeduction: "1600.00",
      netPay: "5600.00",
      status: "approved" as const,
    },
  ];

  const mockSummary = {
    totalEmployees: 2,
    totalGrossPay: "15500.00",
    totalNetPay: "11100.00",
    pendingRecords: 0,
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
    }).format(num);
  };

  const formatPeriod = (period: string) => {
    const periods = {
      monthly: "Monthly",
      bi_weekly: "Bi-weekly",
      weekly: "Weekly",
    };
    return periods[period as keyof typeof periods] || period;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: { variant: "secondary" as const, icon: Clock, label: "Draft" },
      pending: { variant: "default" as const, icon: Clock, label: "Pending" },
      approved: { variant: "default" as const, icon: CheckCircle, label: "Approved" },
      paid: { variant: "default" as const, icon: CheckCircle, label: "Paid" },
    };
    
    const config = variants[status as keyof typeof variants] || variants.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <p className="text-muted-foreground">
            Manage employee payroll configurations and process monthly payroll
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => alert("Payroll Configuration form coming soon!")}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payroll Config
          </Button>
          <Button
            onClick={() => alert("Payroll Processing form coming soon!")}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockSummary.totalEmployees}</div>
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
            <div className="text-2xl font-bold">{formatCurrency(mockSummary.totalGrossPay)}</div>
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
            <div className="text-2xl font-bold">{formatCurrency(mockSummary.totalNetPay)}</div>
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
            <div className="text-2xl font-bold">{mockSummary.pendingRecords}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>
      </div>

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
                  {mockConfigs.map((config) => (
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
                            onClick={() => alert("Edit form coming soon!")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Records</CardTitle>
            </CardHeader>
            <CardContent>
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
                  {mockRecords.map((record) => (
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
                            onClick={() => alert("View details coming soon!")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => alert("Edit record coming soon!")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}