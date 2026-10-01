import { Calculator, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PayrollCalculationPreviewResult } from "@/hooks/use-payroll-calculation-preview";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(amount || 0);
}

function formatSalaryPayDate(value?: string | null): string {
  if (!value) return "";
  const raw = value.includes("T") ? value.split("T")[0] : value;
  const parts = raw.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  const dateObj = new Date(value);
  if (isNaN(dateObj.getTime())) return value;
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const yyyy = dateObj.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

interface PayrollCalculationPreviewPanelProps {
  calculation: PayrollCalculationPreviewResult | null;
  salaryPayDate?: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  emptyMessage?: string;
  className?: string;
  title?: string;
}

export default function PayrollCalculationPreviewPanel({
  calculation,
  salaryPayDate,
  isLoading = false,
  isRefreshing = false,
  error = null,
  emptyMessage = "Enter salary and employee details to preview CPF calculations.",
  className,
  title = "CPF Preview",
}: PayrollCalculationPreviewPanelProps) {
  const showInitialLoader = isLoading && !calculation;
  const formattedPayDate = formatSalaryPayDate(salaryPayDate);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-5 w-5 text-blue-600" />
          {title}
          {isRefreshing && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showInitialLoader ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Calculating payroll...
          </div>
        ) : error ? (
          <div className="py-6 text-sm text-muted-foreground font-medium">{error}</div>
        ) : calculation ? (
          <div className="space-y-2 text-sm">
            {formattedPayDate && (
              <div className="flex justify-between border-b pb-2 mb-2">
                <span className="text-muted-foreground font-medium">Salary Pay Date</span>
                <span className="font-medium text-foreground">{formattedPayDate}</span>
              </div>
            )}
            <div className="flex justify-between border-b pb-2 mb-2">
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
          <div className="space-y-4">
            {formattedPayDate && (
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="text-muted-foreground font-medium">Salary Pay Date</span>
                <span className="font-medium text-foreground">{formattedPayDate}</span>
              </div>
            )}
            <div className="text-center text-muted-foreground py-6">
              <Calculator className="h-12 w-12 mx-auto opacity-30 mb-2" />
              <p className="text-sm">{emptyMessage}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
