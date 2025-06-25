import { useState } from "react";
import Dashboard from "@/components/layout/Dashboard";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Employee } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import EmployeeForm from "@/components/forms/EmployeeForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertCircle,
  FileText,
  Laptop
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DocumentForm from "@/components/forms/DocumentForm";

export default function EmployeesPage() {
  const { toast } = useToast();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  
  // Fetch employees
  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });
  
  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Employee deleted",
        description: "The employee has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete employee",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleEditEmployee = (id: number) => {
    setSelectedEmployeeId(id);
    setIsFormDialogOpen(true);
  };
  
  const handleDeleteEmployee = (id: number) => {
    setSelectedEmployeeId(id);
    setIsDeleteDialogOpen(true);
  };
  
  const handleAddDocument = (id: number) => {
    setSelectedEmployeeId(id);
    setIsDocumentFormOpen(true);
  };
  
  const confirmDelete = () => {
    if (selectedEmployeeId) {
      deleteEmployeeMutation.mutate(selectedEmployeeId);
    }
  };
  
  return (
    <Dashboard title="Employees" description="Manage your organization's employees.">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Button
            onClick={() => {
              setSelectedEmployeeId(null);
              setIsFormDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : employees.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.employeeId}</TableCell>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>{employee.designation}</TableCell>
                      <TableCell>
                        {employee.joinDate && new Date(employee.joinDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col space-y-1">
                          {employee.passportNumber && (
                            <div className="text-xs">
                              <span className="font-medium">Passport:</span>{" "}
                              {employee.passportNumber}
                              {employee.passportExpiry && (
                                <span className="text-gray-500">
                                  {" "}
                                  (Expires: {new Date(employee.passportExpiry).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                          )}
                          {employee.visaNumber && (
                            <div className="text-xs">
                              <span className="font-medium">Visa:</span>{" "}
                              {employee.visaNumber}
                              {employee.visaExpiry && (
                                <span className="text-gray-500">
                                  {" "}
                                  (Expires: {new Date(employee.visaExpiry).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditEmployee(employee.id)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAddDocument(employee.id)}>
                              <FileText className="mr-2 h-4 w-4" />
                              Add Document
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteEmployee(employee.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-800 mb-1">No employees found</h3>
              <p className="text-sm text-gray-500 mb-4">Get started by creating a new employee.</p>
              <Button
                onClick={() => {
                  setSelectedEmployeeId(null);
                  setIsFormDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Employee
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Employee Form - Full Screen Panel */}
      <EmployeeForm
        employee={selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId) : undefined}
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
      />
      
      {/* Document Form Dialog */}
      <Dialog open={isDocumentFormOpen} onOpenChange={setIsDocumentFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
          </DialogHeader>
          <DocumentForm
            employeeId={selectedEmployeeId || undefined}
            onSuccess={() => setIsDocumentFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the employee and all related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteEmployeeMutation.isPending}
            >
              {deleteEmployeeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dashboard>
  );
}
