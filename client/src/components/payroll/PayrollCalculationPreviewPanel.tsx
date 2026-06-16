import { Calculator, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PayrollCalculationPreviewResult } from "@/hooks/use-payroll-calculation-preview";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(amount || 0);
}

interface PayrollCalculationPreviewPanelProps {
  calculation: PayrollCalculationPreviewResult | null;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  className?: string;
}

export default function PayrollCalculationPreviewPanel({
  calculation,
  isLoading = false,
  error = null,
  emptyMessage = "Enter salary and employee details to preview CPF calculations.",
  className,
}: PayrollCalculationPreviewPanelProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          CPF Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Calculating payroll...
          </div>
        ) : error ? (
          <div className="py-6 text-sm text-red-600">{error}</div>
        ) : calculation ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Salary</span>
              <span className="font-medium">
                {formatCurrency(calculation.breakdown?.baseSalary ?? calculation.grossPay)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allowances</span>
              <span>{formatCurrency(calculation.allowancesTotal || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deductions</span>
              <span className="text-red-600">
                -{formatCurrency(calculation.deductionsTotal || 0)}
              </span>
            </div>
            {(calculation.breakdown?.overtimePay ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overtime</span>
                <span>{formatCurrency(calculation.breakdown?.overtimePay || 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Gross Salary</span>
              <span>{formatCurrency(calculation.grossPay || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>CPF Rate (Employee)</span>
              <span>{calculation.employeeCpfRate ?? 0}%</span>
            </div>
            <div className="flex justify-between">
              <span>CPF Amount (Employee)</span>
              <span className="text-red-600">
                -{formatCurrency(calculation.employeeCpf || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>CPF Rate (Employer)</span>
              <span>{calculation.employerCpfRate ?? 0}%</span>
            </div>
            <div className="flex justify-between">
              <span>CPF Amount (Employer)</span>
              <span>{formatCurrency(calculation.employerCpf || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total CPF</span>
              <span>{formatCurrency(calculation.totalCpf || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Annual Salary</span>
              <span>{formatCurrency(calculation.annualSalary || 0)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Net Salary</span>
              <span className="text-green-600">{formatCurrency(calculation.netPay || 0)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <Calculator className="h-12 w-12 mx-auto opacity-30 mb-2" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
