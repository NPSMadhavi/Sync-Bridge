import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { refreshNotificationQueries } from "@/lib/notification-queries";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDate } from "@shared/document-reminder-utils";
import type { DocumentExpiryRecord } from "@shared/document-reminder-utils";
import { Loader2 } from "lucide-react";

interface DocumentExpiryListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  mode: "expiring" | "expired";
  records: DocumentExpiryRecord[];
}

export default function DocumentExpiryListModal({
  open,
  onOpenChange,
  title,
  mode,
  records,
}: DocumentExpiryListModalProps) {
  const { toast } = useToast();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedKeys(new Set());
    }
  }, [open]);

  const allSelected = records.length > 0 && selectedKeys.size === records.length;
  const someSelected = selectedKeys.size > 0 && !allSelected;

  const toggleRecord = (recordKey: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(recordKey);
      else next.delete(recordKey);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(new Set(records.map((r) => r.recordKey)));
    } else {
      setSelectedKeys(new Set());
    }
  };

  const handleSendReminder = async () => {
    if (selectedKeys.size === 0) {
      toast({
        title: "Select records",
        description: "Please select one or more documents before sending a reminder.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/document-reminders/send", {
        recordKeys: Array.from(selectedKeys),
        mode,
        records: records.filter((record) => selectedKeys.has(record.recordKey)),
      });
      const data = await res.json();

      if (!res.ok || !data.sent || data.sent < 1) {
        throw new Error(data.message || "Failed to send reminder.");
      }

      toast({
        title: data.notificationOnly && !data.emailsSent ? "Notification sent" : data.failed > 0 ? "Reminders partially sent" : "Reminder sent",
        description: data.message || "Reminder sent successfully.",
        variant: data.failed > 0 ? "default" : "default",
      });
      onOpenChange(false);
      setSelectedKeys(new Set());
      await refreshNotificationQueries();
    } catch (error: any) {
      toast({
        title: "Reminder not sent",
        description: error.message || "Failed to send reminder email.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No records found.</p>
        ) : (
          <div className="overflow-auto flex-1 border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[52px]">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                      aria-label="Select all records"
                    />
                  </TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>{mode === "expiring" ? "Days Remaining" : "Days Expired"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.recordKey}>
                    <TableCell>
                      <Checkbox
                        checked={selectedKeys.has(record.recordKey)}
                        onCheckedChange={(checked) =>
                          toggleRecord(record.recordKey, checked === true)
                        }
                        aria-label={`Select ${record.documentType}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{record.documentType}</TableCell>
                    <TableCell>{formatDisplayDate(record.expiryDate)}</TableCell>
                    <TableCell>
                      {mode === "expiring"
                        ? `${record.daysRemaining ?? 0} days`
                        : `${record.daysExpired ?? 0} days`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-4">
          <Button variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSubmitting || selectedKeys.size === 0} onClick={handleSendReminder}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
