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
import { Vendor, insertVendorSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Store,
  ShoppingBag
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

// Extend schema for validation
const formSchema = insertVendorSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  contact: z.string().min(5, "Contact details required"),
  email: z.string().email("Please enter a valid email address"),
});

type VendorFormData = z.infer<typeof formSchema>;

export default function VendorsPage() {
  const { toast } = useToast();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  
  // Form setup
  const form = useForm<VendorFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      contact: "",
      email: "",
      assetTypesSupplied: "",
    },
  });
  
  // Reset form when selected vendor changes
  useState(() => {
    if (selectedVendor) {
      form.reset({
        name: selectedVendor.name,
        contact: selectedVendor.contact,
        email: selectedVendor.email,
        assetTypesSupplied: selectedVendor.assetTypesSupplied || "",
      });
    } else {
      form.reset({
        name: "",
        contact: "",
        email: "",
        assetTypesSupplied: "",
      });
    }
  });
  
  // Fetch vendors
  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });
  
  // Create vendor mutation
  const createVendorMutation = useMutation({
    mutationFn: async (data: VendorFormData) => {
      const res = await apiRequest("POST", "/api/vendors", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Vendor created",
        description: "The vendor has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsFormDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create vendor",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update vendor mutation
  const updateVendorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: VendorFormData }) => {
      const res = await apiRequest("PUT", `/api/vendors/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Vendor updated",
        description: "The vendor has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsFormDialogOpen(false);
      setSelectedVendor(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update vendor",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete vendor mutation
  const deleteVendorMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/vendors/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Vendor deleted",
        description: "The vendor has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsDeleteDialogOpen(false);
      setSelectedVendor(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete vendor",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleEditVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsFormDialogOpen(true);
  };
  
  const handleDeleteVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDeleteDialogOpen(true);
  };
  
  const onSubmit = (data: VendorFormData) => {
    if (selectedVendor) {
      updateVendorMutation.mutate({ id: selectedVendor.id, data });
    } else {
      createVendorMutation.mutate(data);
    }
  };
  
  const closeFormDialog = () => {
    setIsFormDialogOpen(false);
    setSelectedVendor(null);
    form.reset();
  };
  
  return (
    <Dashboard title="Vendors" description="Manage your asset suppliers and vendors.">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Button onClick={() => setIsFormDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Vendor
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : vendors.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Asset Types Supplied</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <Store className="mr-2 h-4 w-4 text-primary-500" />
                          {vendor.name}
                        </div>
                      </TableCell>
                      <TableCell>{vendor.contact}</TableCell>
                      <TableCell>{vendor.email}</TableCell>
                      <TableCell>{vendor.assetTypesSupplied || "—"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditVendor(vendor)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteVendor(vendor)}
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
              <ShoppingBag className="h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-800 mb-1">No vendors found</h3>
              <p className="text-sm text-gray-500 mb-4">Get started by adding a new vendor.</p>
              <Button onClick={() => setIsFormDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Vendor
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Vendor Form Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={closeFormDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedVendor ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC Supplies Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Details</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="contact@abcsupplies.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="assetTypesSupplied"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Types Supplied</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Laptops, Monitors, Mobile Phones"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeFormDialog}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createVendorMutation.isPending || updateVendorMutation.isPending}
                >
                  {createVendorMutation.isPending || updateVendorMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {selectedVendor ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>{selectedVendor ? "Update Vendor" : "Create Vendor"}</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the vendor and may affect
              assets associated with this vendor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedVendor && deleteVendorMutation.mutate(selectedVendor.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteVendorMutation.isPending}
            >
              {deleteVendorMutation.isPending ? (
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
