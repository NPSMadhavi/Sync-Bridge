import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, Mail, Phone, MapPin, Globe, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Dashboard from "@/components/layout/Dashboard";
import { TableRowActions } from "@/components/ui/table-row-actions";
import {
  EntityViewField,
  EntityViewFieldGrid,
  EntityViewSection,
  EntityViewSheet,
  formatViewDate,
  formatViewValue,
} from "@/components/ui/entity-view-sheet";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  taxId: string;
  isActive: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  taxId: string;
  isActive: boolean;
  notes: string;
}

export default function CustomersPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerToDeleteId, setCustomerToDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    taxId: '',
    isActive: true,
    notes: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Fetch customers based on user role
  const { data: customers = [], isLoading } = useQuery({
    queryKey: user?.role === 'vendor' ? ['vendor-customers', user?.email] : ['customers'],
    queryFn: async () => {
      if (user?.role === 'vendor') {
        // For vendors, fetch vendor customers
        const response = await apiRequest('GET', `/api/vendor/customers?vendorEmail=${user.email}`);
        const vendorCustomers = await response.json();
        // Transform vendor customers to match Customer interface
        return vendorCustomers.map((vc: any) => ({
          id: vc.id,
          name: vc.customerName,
          email: vc.customerEmail,
          phone: vc.customerPhone,
          company: vc.customerName,
          address: vc.customerAddress,
          city: '',
          state: '',
          zipCode: '',
          country: '',
          taxId: '',
          isActive: true,
          notes: '',
          created_at: vc.createdAt,
          updated_at: vc.updatedAt || vc.createdAt,
        }));
      } else {
        // For regular users, fetch tenant customers
        const response = await apiRequest('GET', '/api/customers');
        return response.json();
      }
    },
    enabled: !!user,
  });

  // Add customer mutation
  const addCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (user?.role === 'vendor') {
        const vendorCustomerData = {
          vendorEmail: user.email,
          customerName: data.name,
          customerEmail: data.email,
          customerPhone: data.phone,
          customerAddress: data.address,
        };
        const response = await apiRequest('POST', '/api/vendor/customers', vendorCustomerData);
        return response.json();
      } else {
        // Strip tenantId — server sets it from middleware
        const { ...payload } = data;
        const response = await apiRequest('POST', '/api/customers', payload);
        return response.json();
      }
    },
    onSuccess: () => {
      if (user?.role === 'vendor') {
        queryClient.invalidateQueries({ queryKey: ['vendor-customers', user?.email] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      }
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Customer added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add customer",
        variant: "destructive",
      });
    }
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
      if (user?.role === 'vendor') {
        const vendorCustomerData = {
          customerName: data.name,
          customerEmail: data.email,
          customerPhone: data.phone,
          customerAddress: data.address,
        };
        const response = await apiRequest('PUT', `/api/vendor/customers/${id}`, vendorCustomerData);
        return response.json();
      } else {
        const response = await apiRequest('PUT', `/api/customers/${id}`, data);
        return response.json();
      }
    },
    onSuccess: () => {
      if (user?.role === 'vendor') {
        queryClient.invalidateQueries({ queryKey: ['vendor-customers', user?.email] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      }
      setIsEditDialogOpen(false);
      setSelectedCustomer(null);
      resetForm();
      toast({
        title: "Success",
        description: "Customer updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
    }
  });

  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      if (user?.role === 'vendor') {
        // For vendors, delete vendor customer
        await apiRequest('DELETE', `/api/vendor/customers/${id}`);
      } else {
        // For regular users, delete tenant customer
        await apiRequest('DELETE', `/api/customers/${id}`);
      }
    },
    onSuccess: () => {
      if (user?.role === 'vendor') {
        queryClient.invalidateQueries({ queryKey: ['vendor-customers', user?.email] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      }
      setIsDeleteDialogOpen(false);
      setCustomerToDeleteId(null);
      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      taxId: '',
      isActive: true,
      notes: ''
    });
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zipCode,
      country: customer.country,
      taxId: customer.taxId,
      isActive: customer.isActive,
      notes: customer.notes
    });
    setIsEditDialogOpen(true);
  };

  const handleView = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsViewDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setCustomerToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (customerToDeleteId) {
      deleteCustomerMutation.mutate(customerToDeleteId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomer) {
      updateCustomerMutation.mutate({ id: selectedCustomer.id, data: formData });
    } else {
      addCustomerMutation.mutate(formData);
    }
  };

  const filteredCustomers = customers.filter((customer: Customer) =>
    (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.company?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education',
    'Real Estate', 'Transportation', 'Energy', 'Consulting', 'Media', 'Other'
  ];

  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Australia',
    'Singapore', 'Japan', 'China', 'India', 'Brazil', 'Mexico', 'Other'
  ];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'prospect':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <Dashboard>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
        
          <h1 className="text-[32px] font-bold">Customers</h1>
        </div>
        <Button onClick={() => {
          resetForm();
          setIsAddDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Add Customer Sheet */}
      <Sheet open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <SheetContent 
          side="right" 
          className="p-0 flex flex-col"
          style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-gray-900">
                Add New Customer
              </SheetTitle>
              <p className="text-sm text-gray-600 mt-2">
                Add a new customer to your organization
              </p>
            </SheetHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-24">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="zipCode">Postal Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="taxId">Tax ID</Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="isActive">Status</Label>
                  <Select value={formData.isActive ? 'active' : 'inactive'} onValueChange={(value) => setFormData({ ...formData, isActive: value === 'active' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addCustomerMutation.isPending}>
                  {addCustomerMutation.isPending ? 'Adding...' : 'Add Customer'}
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Customer Management</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading customers...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer: Customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      <div className="font-medium">{customer.company || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {customer.city && customer.state ? `${customer.city}, ${customer.state}` : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(customer.isActive ? 'active' : 'inactive')}>
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TableRowActions
                        actions={[
                          {
                            icon: Eye,
                            label: "View",
                            variant: "view",
                            onClick: () => handleView(customer),
                          },
                          {
                            icon: Edit,
                            label: "Edit",
                            variant: "edit",
                            onClick: () => handleEdit(customer),
                          },
                          {
                            icon: Trash2,
                            label: "Delete",
                            variant: "delete",
                            onClick: () => handleDelete(customer.id),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Customer Sheet */}
      <Sheet open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <SheetContent 
          side="right" 
          className="p-0 flex flex-col"
          style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-gray-900">
                Edit Customer
              </SheetTitle>
              <p className="text-sm text-gray-600 mt-2">
                Update customer information
              </p>
            </SheetHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-24">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_name">Name</Label>
                <Input
                  id="edit_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_email">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_phone">Phone</Label>
                <Input
                  id="edit_phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_company">Company</Label>
                <Input
                  id="edit_company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="edit_address">Address</Label>
                <Textarea
                  id="edit_address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_city">City</Label>
                <Input
                  id="edit_city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_state">State/Province</Label>
                <Input
                  id="edit_state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_zipCode">Postal Code</Label>
                <Input
                  id="edit_zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_country">Country</Label>
                <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_taxId">Tax ID</Label>
                <Input
                  id="edit_taxId"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_isActive">Status</Label>
                <Select value={formData.isActive ? 'active' : 'inactive'} onValueChange={(value) => setFormData({ ...formData, isActive: value === 'active' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateCustomerMutation.isPending}>
                {updateCustomerMutation.isPending ? 'Updating...' : 'Update Customer'}
              </Button>
            </div>
          </form>
          </div>
        </SheetContent>
      </Sheet>

      {selectedCustomer && (
        <EntityViewSheet
          open={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
          title="Customer Details"
          description="View complete customer information"
          onClose={() => {
            setIsViewDialogOpen(false);
            setSelectedCustomer(null);
          }}
        >
          <EntityViewSection title="Customer Information">
            <EntityViewFieldGrid>
              <EntityViewField label="Name" value={selectedCustomer.name} />
              <EntityViewField label="Company" value={formatViewValue(selectedCustomer.company)} />
              <EntityViewField label="Email" value={selectedCustomer.email} />
              <EntityViewField label="Phone" value={formatViewValue(selectedCustomer.phone)} />
              <EntityViewField
                label="Status"
                value={selectedCustomer.isActive ? "Active" : "Inactive"}
              />
              <EntityViewField label="Tax ID" value={formatViewValue(selectedCustomer.taxId)} />
            </EntityViewFieldGrid>
          </EntityViewSection>

          <EntityViewSection title="Address">
            <EntityViewFieldGrid>
              <EntityViewField label="Address" value={formatViewValue(selectedCustomer.address)} fullWidth />
              <EntityViewField label="City" value={formatViewValue(selectedCustomer.city)} />
              <EntityViewField label="State" value={formatViewValue(selectedCustomer.state)} />
              <EntityViewField label="Zip Code" value={formatViewValue(selectedCustomer.zipCode)} />
              <EntityViewField label="Country" value={formatViewValue(selectedCustomer.country)} />
            </EntityViewFieldGrid>
          </EntityViewSection>

          <EntityViewSection title="Additional Details">
            <EntityViewFieldGrid>
              <EntityViewField label="Notes" value={formatViewValue(selectedCustomer.notes)} fullWidth />
            </EntityViewFieldGrid>
          </EntityViewSection>

        </EntityViewSheet>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteCustomerMutation.isPending}
            >
              {deleteCustomerMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dashboard>
  );
} 