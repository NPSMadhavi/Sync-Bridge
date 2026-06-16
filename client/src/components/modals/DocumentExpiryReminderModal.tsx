import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StringDatePicker } from "@/components/ui/string-date-picker";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDate } from "@shared/document-reminder-utils";

export type ExpiryRecord = {
  employeeDbId: number;
  employeeId: string;
  employeeName: string;
  email?: string;
  documentType: string;
  expiryDate: string;
  dependentId?: number | null;
  dependentName?: string | null;
  reminderType: string;
};

interface DocumentExpiryReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ExpiryRecord | null;
}

export default function DocumentExpiryReminderModal({
  open,
  onOpenChange,
  record,
}: DocumentExpiryReminderModalProps) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (action: "close" | "snooze_week") => {
    if (!record) return;
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/document-reminders/schedule", {
        employeeId: record.employeeDbId,
        dependentId: record.dependentId ?? null,
        documentType: record.reminderType,
        action,
        startDate: startDate || null,
        endDate: endDate || null,
        expiryDate: record.expiryDate,
      });
      toast({
        title: action === "snooze_week" ? "Reminder scheduled" : "Reminder updated",
        description:
          action === "snooze_week"
            ? "You will be reminded again in 1 week."
            : "You will be reminded again tomorrow.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule reminder",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Document Expiry Reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Employee ID</span>
              <p className="font-medium">{record.employeeId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Employee Name</span>
              <p className="font-medium">{record.employeeName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Document Type</span>
              <p className="font-medium">{record.documentType}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Current Expiry Date</span>
              <p className="font-medium">{formatDisplayDate(record.expiryDate)}</p>
            </div>
            {record.dependentName && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Dependent</span>
                <p className="font-medium">{record.dependentName}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <StringDatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <Label>End Date</Label>
              <StringDatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={isSubmitting} onClick={() => handleAction("close")}>
            Close
          </Button>
          <Button disabled={isSubmitting} onClick={() => handleAction("snooze_week")}>
            Reminder After 1 Week
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
