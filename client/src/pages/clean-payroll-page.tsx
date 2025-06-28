import { useState } from "react";
import Dashboard from "@/components/layout/Dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";

export default function PayrollPage() {
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);

  // Mock data for demonstration
  const mockConfigs = [
    {
      id: 1,
      employeeName: "John Doe",
      department: "Engineering",
      designation: "Senior Developer",
      baseSalary: "8000.00",
      payrollPeriod: "Monthly",
      taxRate: "10.00",
      cpfRate: "20.00",
      isActive: true,
    },
    {
      id: 2,
      employeeName: "Jane Smith",
      department: "HR",
      designation: "HR Manager",
      baseSalary: "7500.00",
      payrollPeriod: "Monthly",
      taxRate: "10.00",
      cpfRate: "20.00",
      isActive: true,
    },
  ];

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
    }).format(parseFloat(amount));
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
        <div className="flex gap-2">
          <Button
            onClick={() => setShowConfigForm(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payroll Config
          </Button>
          <Button
            onClick={() => setShowRecordForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
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
            <div className="text-2xl font-bold">{formatCurrency("15500.00")}</div>
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
            <div className="text-2xl font-bold">{formatCurrency("11100.00")}</div>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Payroll Configurations */}
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
                  <TableCell>{config.payrollPeriod}</TableCell>
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
                        onClick={() => setShowConfigForm(true)}
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

      {/* Dialog for Payroll Config Form */}
      <Dialog open={showConfigForm} onOpenChange={setShowConfigForm}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <PayrollConfigForm
            onSuccess={() => setShowConfigForm(false)}
            onCancel={() => setShowConfigForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog for Payroll Record Form */}
      <Dialog open={showRecordForm} onOpenChange={setShowRecordForm}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <ProcessPayrollForm
            onSuccess={() => setShowRecordForm(false)}
            onCancel={() => setShowRecordForm(false)}
          />
        </DialogContent>
      </Dialog>
    </Dashboard>
  );
}