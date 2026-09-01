import React, { useState } from 'react';
import Dashboard from "@/components/layout/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FormSheetHeader } from "@/components/ui/form-sheet-header";
import { FormSheetFooter, formSheetCancelClass, formSheetSubmitClass } from "@/components/ui/form-sheet-footer";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, Mail, Phone, MapPin, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { TableRowActions } from "@/components/ui/table-row-actions";
import {
  EntityViewField,
  EntityViewFieldGrid,
  EntityViewSection,
  EntityViewSheet,
  formatViewDate,
  formatViewValue,
} from "@/components/ui/entity-view-sheet";
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
import { useUrlSearchParam } from "@/hooks/use-url-search-param";
import { matchesTableSearch } from "@/lib/table-search";
import { TablePagination, usePaginatedItems } from "@/components/ui/table-pagination";

interface Vendor {
  id: number;
  tenantId: number;
  name: string;
  contact: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  registrationNumber?: string;
  assetTypesSupplied?: string;
  paymentTerms?: string;
  creditLimit?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

interface VendorFormData {
  name: string;
  contact: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  taxId: string;
  registrationNumber: string;
  assetTypesSupplied: string;
  paymentTerms: string;
  creditLimit: string;
  notes: string;
}

export default function VendorsPage() {
  const { user, tenantId } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const searchTerm = useUrlSearchParam();
  const [formData, setFormData] = useState<VendorFormData>({
    name: '',
    contact: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    taxId: '',
    registrationNumber: '',
    assetTypesSupplied: '',
    paymentTerms: '',
    creditLimit: '',
    notes: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch vendors
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['/api/vendors', tenantId],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/vendors');
      return response.json();
    },
    enabled: !!user,
  });

  // Add vendor mutation
  const addVendorMutation = useMutation({
    mutationFn: async (data: VendorFormData) => {
      const cleanedData = {
        name: data.name,
        contact: data.contact,
        email: data.email,
        phone: data.phone || null,
        website: data.website || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        country: data.country || null,
        taxId: data.taxId || null,
        registrationNumber: data.registrationNumber || null,
        assetTypesSupplied: data.assetTypesSupplied || null,
        paymentTerms: data.paymentTerms || null,
        creditLimit: data.creditLimit || null,
        notes: data.notes || null,
        isActive: true,
      };
      const response = await apiRequest('POST', '/api/vendors', cleanedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      setIsAddModalOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Vendor added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add vendor",
        variant: "destructive",
      });
    }
  });

  // Update vendor mutation
  const updateVendorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VendorFormData }) => {
      const cleanedData = {
        ...data,
        phone: data.phone || null,
        website: data.website || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        country: data.country || null,
        taxId: data.taxId || null,
        registrationNumber: data.registrationNumber || null,
        assetTypesSupplied: data.assetTypesSupplied || null,
        paymentTerms: data.paymentTerms || null,
        creditLimit: data.creditLimit || null,
        notes: data.notes || null,
        isActive: true,
      };
      const response = await apiRequest('PUT', `/api/vendors/${id}`, cleanedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      setIsEditModalOpen(false);
      setSelectedVendor(null);
      resetForm();
      toast({
        title: "Success",
        description: "Vendor updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vendor",
        variant: "destructive",
      });
    }
  });

  // Delete vendor mutation
  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      setIsDeleteDialogOpen(false);
      toast({
        title: "Success",
        description: "Vendor deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete vendor",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      contact: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      taxId: '',
      registrationNumber: '',
      assetTypesSupplied: '',
      paymentTerms: '',
      creditLimit: '',
      notes: ''
    });
  };

  const handleEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setFormData({
      name: vendor.name,
      contact: vendor.contact,
      email: vendor.email,
      phone: vendor.phone || '',
      website: vendor.website || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      zipCode: vendor.zipCode || '',
      country: vendor.country || '',
      taxId: vendor.taxId || '',
      registrationNumber: vendor.registrationNumber || '',
      assetTypesSupplied: vendor.assetTypesSupplied || '',
      paymentTerms: vendor.paymentTerms || '',
      creditLimit: vendor.creditLimit || '',
      notes: vendor.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleView = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsViewModalOpen(true);
  };

  const handleDelete = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedVendor) {
      deleteVendorMutation.mutate(selectedVendor.id.toString());
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVendorMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVendor) {
      updateVendorMutation.mutate({ id: selectedVendor.id.toString(), data: formData });
    }
  };

  const closeAddSheet = () => {
    setIsAddModalOpen(false);
    resetForm();
  };

  const closeEditSheet = () => {
    setIsEditModalOpen(false);
    setSelectedVendor(null);
    resetForm();
  };

  const renderVendorFormFields = (idPrefix: string) => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${idPrefix}name`}>Vendor Name</Label>
          <Input
            id={`${idPrefix}name`}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}contact`}>Contact Person</Label>
          <Input
            id={`${idPrefix}contact`}
            value={formData.contact}
            onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}email`}>Email</Label>
          <Input
            id={`${idPrefix}email`}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}phone`}>Phone</Label>
          <Input
            id={`${idPrefix}phone`}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}website`}>Website</Label>
          <Input
            id={`${idPrefix}website`}
            type="url"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}taxId`}>Tax ID</Label>
          <Input
            id={`${idPrefix}taxId`}
            value={formData.taxId}
            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor={`${idPrefix}address`}>Address</Label>
          <Textarea
            id={`${idPrefix}address`}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows={3}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}city`}>City</Label>
          <Input
            id={`${idPrefix}city`}
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}state`}>State</Label>
          <Input
            id={`${idPrefix}state`}
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}zipCode`}>Zip Code</Label>
          <Input
            id={`${idPrefix}zipCode`}
            value={formData.zipCode}
            onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}country`}>Country</Label>
          <Input
            id={`${idPrefix}country`}
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}registrationNumber`}>Registration Number</Label>
          <Input
            id={`${idPrefix}registrationNumber`}
            value={formData.registrationNumber}
            onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}paymentTerms`}>Payment Terms</Label>
          <Input
            id={`${idPrefix}paymentTerms`}
            value={formData.paymentTerms}
            onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}assetTypesSupplied`}>Asset Types Supplied</Label>
          <Input
            id={`${idPrefix}assetTypesSupplied`}
            value={formData.assetTypesSupplied}
            onChange={(e) => setFormData({ ...formData, assetTypesSupplied: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}creditLimit`}>Credit Limit</Label>
          <Input
            id={`${idPrefix}creditLimit`}
            value={formData.creditLimit}
            onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}notes`}>Notes</Label>
        <Textarea
          id={`${idPrefix}notes`}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
      </div>
    </>
  );

  const filteredVendors = vendors.filter((vendor: Vendor) =>
    matchesTableSearch(
      searchTerm,
      vendor.name,
      vendor.email,
      vendor.contact,
      vendor.phone,
      vendor.website,
      vendor.city,
      vendor.country
    )
  );

  const { page, setPage, paginatedItems, pageSize, totalItems } = usePaginatedItems(filteredVendors, [searchTerm]);

  return (
<Dashboard
  title={
    <div className="flex justify-between items-center w-full">
      <span className="text-[32px] font-bold">Vendors</span>
      <Button
        onClick={() => {
          resetForm();
          setSelectedVendor(null);
          setIsAddModalOpen(true);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Vendor
      </Button>
    </div>
  }
  description="Manage your organization's vendors."
>
      <Card>
        <CardHeader>
          <CardTitle>All Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading vendors...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No vendors found. Click &quot;Add Vendor&quot; to create one.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((vendor: Vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <div className="font-medium">{vendor.name}</div>
                        {vendor.website && (
                          <div className="text-sm text-gray-500 flex items-center">
                            <Globe className="mr-1 h-3 w-3" />
                            {vendor.website}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{vendor.contact}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Mail className="mr-1 h-3 w-3 text-gray-400" />
                          {vendor.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Phone className="mr-1 h-3 w-3 text-gray-400" />
                          {vendor.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={vendor.isActive ? 'default' : 'secondary'}>
                          {vendor.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TableRowActions
                          actions={[
                            {
                              icon: Eye,
                              label: "View",
                              variant: "view",
                              onClick: () => handleView(vendor),
                            },
                            {
                              icon: Edit,
                              label: "Edit",
                              variant: "edit",
                              onClick: () => handleEdit(vendor),
                            },
                            {
                              icon: Trash2,
                              label: "Delete",
                              variant: "delete",
                              onClick: () => handleDelete(vendor),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={page}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Vendor Sheet */}
      <Sheet open={isAddModalOpen} onOpenChange={(open) => !open && closeAddSheet()}>
        <SheetContent
          side="right"
          hideClose
          className="p-0 flex flex-col overflow-hidden"
          style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
        >
          <FormSheetHeader
            title="Add New Vendor"
            description="Add a new vendor to your organization"
            onClose={closeAddSheet}
          />
          <form onSubmit={handleAddSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {renderVendorFormFields("")}
            </div>
            <FormSheetFooter>
              <Button type="button" variant="outline" className={formSheetCancelClass} onClick={closeAddSheet}>
                Cancel
              </Button>
              <Button type="submit" className={formSheetSubmitClass} disabled={addVendorMutation.isPending}>
                {addVendorMutation.isPending ? "Adding..." : "Create"}
              </Button>
            </FormSheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Vendor Sheet */}
      <Sheet open={isEditModalOpen} onOpenChange={(open) => !open && closeEditSheet()}>
        <SheetContent
          side="right"
          hideClose
          className="p-0 flex flex-col overflow-hidden"
          style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
        >
          <FormSheetHeader
            title="Edit Vendor"
            description="Update vendor information"
            onClose={closeEditSheet}
          />
          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {renderVendorFormFields("edit_")}
            </div>
            <FormSheetFooter>
              <Button type="button" variant="outline" className={formSheetCancelClass} onClick={closeEditSheet}>
                Cancel
              </Button>
              <Button type="submit" className={formSheetSubmitClass} disabled={updateVendorMutation.isPending}>
                {updateVendorMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </FormSheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {selectedVendor && (
        <EntityViewSheet
          open={isViewModalOpen}
          onOpenChange={setIsViewModalOpen}
          title="Vendor Details"
          description="View complete vendor information"
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedVendor(null);
          }}
        >
          <EntityViewSection title="Vendor Information">
            <EntityViewFieldGrid>
              <EntityViewField label="Vendor Name" value={selectedVendor.name} />
              <EntityViewField label="Contact Person" value={selectedVendor.contact} />
              <EntityViewField label="Email" value={selectedVendor.email} />
              <EntityViewField label="Phone" value={formatViewValue(selectedVendor.phone)} />
              <EntityViewField label="Website">
                {selectedVendor.website ? (
                  <a
                    href={
                      selectedVendor.website.startsWith("http")
                        ? selectedVendor.website
                        : `https://${selectedVendor.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {selectedVendor.website}
                  </a>
                ) : (
                  "—"
                )}
              </EntityViewField>
              <EntityViewField
                label="Status"
                value={selectedVendor.isActive ? "Active" : "Inactive"}
              />
            </EntityViewFieldGrid>
          </EntityViewSection>

          <EntityViewSection title="Address">
            <EntityViewFieldGrid>
              <EntityViewField label="Address" value={formatViewValue(selectedVendor.address)} fullWidth />
              <EntityViewField label="City" value={formatViewValue(selectedVendor.city)} />
              <EntityViewField label="State" value={formatViewValue(selectedVendor.state)} />
              <EntityViewField label="Zip Code" value={formatViewValue(selectedVendor.zipCode)} />
              <EntityViewField label="Country" value={formatViewValue(selectedVendor.country)} />
            </EntityViewFieldGrid>
          </EntityViewSection>

          <EntityViewSection title="Business Details">
            <EntityViewFieldGrid>
              <EntityViewField label="Tax ID" value={formatViewValue(selectedVendor.taxId)} />
              <EntityViewField
                label="Registration Number"
                value={formatViewValue(selectedVendor.registrationNumber)}
              />
              <EntityViewField
                label="Asset Types Supplied"
                value={formatViewValue(selectedVendor.assetTypesSupplied)}
              />
              <EntityViewField label="Payment Terms" value={formatViewValue(selectedVendor.paymentTerms)} />
              <EntityViewField label="Credit Limit" value={formatViewValue(selectedVendor.creditLimit)} />
              <EntityViewField label="Notes" value={formatViewValue(selectedVendor.notes)} fullWidth />
            </EntityViewFieldGrid>
          </EntityViewSection>

        </EntityViewSheet>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the vendor record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteVendorMutation.isPending}
            >
              {deleteVendorMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dashboard>
  );
} 