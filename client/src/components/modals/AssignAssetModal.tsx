import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StringDatePicker } from "@/components/ui/string-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Asset, Employee } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface AssignAssetModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AssignAssetModal({ open, onClose }: AssignAssetModalProps) {
  const { toast } = useToast();
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [assignmentDate, setAssignmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>("");
  
  // Fetch available assets
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    queryFn: () => apiRequest("GET", "/api/assets").then((res) => res.json()),
    select: (data) => data.filter(asset => asset.status === 'available'),
    enabled: open,
  });
  
  // Fetch employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: () => apiRequest("GET", "/api/employees").then((res) => res.json()),
    enabled: open,
  });
  
  // Create asset assignment mutation
  const assignAssetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/asset-assignments", data);
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      toast({
        title: "Asset assigned successfully",
        description: "The asset has been assigned to the employee.",
      });
      
      // Close modal and reset form
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to assign asset",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleSubmit = () => {
    if (!selectedAssetId || !selectedEmployeeId) {
      toast({
        title: "Missing required fields",
        description: "Please select both an asset and an employee.",
        variant: "destructive",
      });
      return;
    }
    
    assignAssetMutation.mutate({
      assetId: parseInt(selectedAssetId),
      employeeId: parseInt(selectedEmployeeId),
      dateAssigned: new Date(assignmentDate),
      notes: notes.trim() ? notes : undefined,
    });
  };
  
  const handleClose = () => {
    setSelectedAssetId("");
    setSelectedEmployeeId("");
    setAssignmentDate(new Date().toISOString().split('T')[0]);
    setNotes("");
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Asset</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="asset">Asset</Label>
            <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
              <SelectTrigger id="asset">
                <SelectValue placeholder="Select an asset" />
              </SelectTrigger>
              <SelectContent>
                {assets.length > 0 ? (
                  assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id.toString()}>
                      {asset.type} - {asset.tag} ({asset.serial})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No available assets</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="employee">Employee</Label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger id="employee">
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.length > 0 ? (
                  employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>
                      {employee.name} ({employee.department})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No employees found</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="date">Assignment Date</Label>
            <StringDatePicker
              value={assignmentDate}
              onChange={setAssignmentDate}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter any additional notes here..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedAssetId || !selectedEmployeeId || assignAssetMutation.isPending}
          >
            {assignAssetMutation.isPending ? "Assigning..." : "Assign Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
