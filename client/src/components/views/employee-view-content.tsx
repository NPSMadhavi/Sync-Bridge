import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EntityViewField,
  EntityViewFieldGrid,
  EntityViewSection,
  formatViewDate,
  formatViewStatus,
  formatViewValue,
} from "@/components/ui/entity-view-sheet";

interface EmployeeViewEmployee {
  id: number;
  tenantId?: number;
  employeeId: string;
  userId?: number;
  name: string;
  department: string;
  designation: string;
  joinDate: string;
  dateOfBirth?: string;
  salary?: string | number;
  status: string;
  nationality?: string;
  prStatus?: string | null;
  nricNumber?: string;
  finNumber?: string;
  passportNumber?: string;
  passportExpiry?: string;
  visaNumber?: string;
  visaExpiry?: string;
  visaType?: string;
  visaRemarks?: string;
  passportScan?: string;
  visaScan?: string;
  nricScan?: string;
  companyId?: number | null;
  companyName?: string | null;
  createdAt?: string;
}

interface EmployeeViewContentProps {
  employee: EmployeeViewEmployee;
  companyDisplay: string;
  nationalityLabel: string;
  prStatusLabel: string;
  visaTypeLabel: string;
  getDisplayValue: (key: string, number: string) => string;
  onToggleVisibility: (key: string, number: string) => void;
  isFieldVisible: (key: string) => boolean;
}

function SensitiveField({
  label,
  fieldKey,
  value,
  getDisplayValue,
  onToggleVisibility,
  isFieldVisible,
}: {
  label: string;
  fieldKey: string;
  value?: string;
  getDisplayValue: (key: string, number: string) => string;
  onToggleVisibility: (key: string, number: string) => void;
  isFieldVisible: (key: string) => boolean;
}) {
  if (!value) {
    return <EntityViewField label={label} value="—" />;
  }

  return (
    <EntityViewField label={label}>
      <div className="flex items-center gap-2">
        <span>{getDisplayValue(fieldKey, value)}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={() => onToggleVisibility(fieldKey, value)}
        >
          {isFieldVisible(fieldKey) ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </EntityViewField>
  );
}

function DocumentLink({ label, path }: { label: string; path?: string }) {
  return (
    <EntityViewField label={label}>
      {path ? (
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          View document
        </a>
      ) : (
        "—"
      )}
    </EntityViewField>
  );
}

function formatCurrency(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function annualSalary(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "—";
  return (num * 12).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function EmployeeViewContent({
  employee,
  companyDisplay,
  nationalityLabel,
  prStatusLabel,
  visaTypeLabel,
  getDisplayValue,
  onToggleVisibility,
  isFieldVisible,
}: EmployeeViewContentProps) {
  return (
    <div className="space-y-4">
      <EntityViewSection title="Employee Information">
        <EntityViewFieldGrid>
          <EntityViewField label="Employee ID" value={employee.employeeId} />
          <EntityViewField label="Full Name" value={employee.name} />
          <EntityViewField label="Department" value={employee.department} />
          <EntityViewField label="Designation" value={employee.designation} />
          <EntityViewField label="Company" value={companyDisplay} />
        </EntityViewFieldGrid>
      </EntityViewSection>

      <EntityViewSection title="Employment Details">
        <EntityViewFieldGrid>
          <EntityViewField label="Join Date" value={formatViewDate(employee.joinDate)} />
          <EntityViewField label="Salary" value={formatCurrency(employee.salary)} />
          <EntityViewField label="Annual Salary" value={annualSalary(employee.salary)} />
          <EntityViewField label="Status">
            <Badge variant={employee.status === "active" ? "default" : "secondary"}>
              {formatViewStatus(employee.status)}
            </Badge>
          </EntityViewField>
        </EntityViewFieldGrid>
      </EntityViewSection>

      <EntityViewSection title="Personal Details">
        <EntityViewFieldGrid>
          <SensitiveField
            label="NRIC / ID Number"
            fieldKey="view_nric"
            value={employee.nricNumber}
            getDisplayValue={getDisplayValue}
            onToggleVisibility={onToggleVisibility}
            isFieldVisible={isFieldVisible}
          />
          <SensitiveField
            label="FIN Number"
            fieldKey="view_fin"
            value={employee.finNumber}
            getDisplayValue={getDisplayValue}
            onToggleVisibility={onToggleVisibility}
            isFieldVisible={isFieldVisible}
          />
          <SensitiveField
            label="Passport Number"
            fieldKey="view_passport"
            value={employee.passportNumber}
            getDisplayValue={getDisplayValue}
            onToggleVisibility={onToggleVisibility}
            isFieldVisible={isFieldVisible}
          />
          <EntityViewField
            label="Passport Expiry"
            value={formatViewDate(employee.passportExpiry)}
          />
          <EntityViewField label="Date of Birth" value={formatViewDate(employee.dateOfBirth)} />
          <EntityViewField label="Nationality" value={nationalityLabel} />
          <EntityViewField label="PR Status" value={prStatusLabel} />
        </EntityViewFieldGrid>
      </EntityViewSection>

      <EntityViewSection title="Immigration Details">
        <EntityViewFieldGrid>
          <EntityViewField label="Visa Type" value={visaTypeLabel} />
          <SensitiveField
            label="Visa / Work Permit Number"
            fieldKey="view_visa"
            value={employee.visaNumber}
            getDisplayValue={getDisplayValue}
            onToggleVisibility={onToggleVisibility}
            isFieldVisible={isFieldVisible}
          />
          <EntityViewField label="Visa Expiry" value={formatViewDate(employee.visaExpiry)} />
          <EntityViewField
            label="Visa Remarks"
            value={formatViewValue(employee.visaRemarks)}
            fullWidth
          />
        </EntityViewFieldGrid>
      </EntityViewSection>

      <EntityViewSection title="Documents">
        <EntityViewFieldGrid>
          <DocumentLink label="Passport Scan" path={employee.passportScan} />
          <DocumentLink label="Visa Scan" path={employee.visaScan} />
          <DocumentLink label="NRIC Scan" path={employee.nricScan} />
        </EntityViewFieldGrid>
      </EntityViewSection>

      <EntityViewSection title="System Information">
        <EntityViewFieldGrid>
          <EntityViewField label="Created Date" value={formatViewDate(employee.createdAt)} />
          <EntityViewField label="Updated Date" value="—" />
          <EntityViewField label="Internal ID" value={String(employee.id)} />
          <EntityViewField
            label="User ID"
            value={employee.userId != null ? String(employee.userId) : "—"}
          />
        </EntityViewFieldGrid>
      </EntityViewSection>
    </div>
  );
}

export function getVisaTypeLabel(visaType?: string | null): string {
  if (!visaType) return "—";
  const map: Record<string, string> = {
    s_pass: "S Pass",
    work_permit: "Work Permit",
    employment_pass: "Employment Pass",
    pr: "PR",
    dependent_pass: "Dependent Pass",
    ltvp: "LTVP",
    student_pass: "Student Pass",
    other: "Other",
  };
  return map[visaType] || formatViewStatus(visaType);
}

export function getPrStatusLabel(
  nationality?: string | null,
  prStatus?: string | null
): string {
  const n = nationality === "foreigner" ? "foreigner" : nationality === "pr" ? "pr" : "citizen";
  if (n === "foreigner") return "Not Applicable";
  if (n === "citizen") return "Not Applicable";
  const map: Record<string, string> = {
    year_1: "Year 1",
    year_2: "Year 2",
    year_3_plus: "Year 3+",
  };
  return prStatus ? map[prStatus] || formatViewStatus(prStatus) : "—";
}
