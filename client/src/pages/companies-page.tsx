import React, { useState } from "react";
import Dashboard from "@/components/layout/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Globe, Phone, MapPin, Edit, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TableRowActions } from "@/components/ui/table-row-actions";
import {
  EntityViewField,
  EntityViewFieldGrid,
  EntityViewSection,
  EntityViewSheet,
  formatViewDate,
  formatViewValue,
} from "@/components/ui/entity-view-sheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

interface Company {
  id: number;
  tenantId?: number | null;
  companyName: string;
  uenNumber: string;
  address?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
  createdAt: string;
}

interface CompanyFormData {
  companyName: string;
  uenNumber: string;
  address: string;
  phoneNumber: string;
  website: string;
}

const emptyForm: CompanyFormData = {
  companyName: "",
  uenNumber: "",
  address: "",
  phoneNumber: "",
  website: "",
};

export default function CompaniesPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState<CompanyFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CompanyFormData, string>>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/companies");
      return response.json();
    },
  });

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CompanyFormData, string>> = {};
    if (!formData.companyName.trim()) errors.companyName = "Company name is required";
    if (!formData.uenNumber.trim()) errors.uenNumber = "UEN number is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const addCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const response = await apiRequest("POST", "/api/companies", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsAddModalOpen(false);
      resetForm();
      toast({ title: "Success", description: "Company added successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add company",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CompanyFormData }) => {
      const response = await apiRequest("PUT", `/api/companies/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsEditModalOpen(false);
      setSelectedCompany(null);
      resetForm();
      toast({ title: "Success", description: "Company updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company",
        variant: "destructive",
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsDeleteDialogOpen(false);
      setSelectedCompany(null);
      toast({ title: "Success", description: "Company deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setFormErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      companyName: formData.companyName.trim(),
      uenNumber: formData.uenNumber.trim(),
      address: formData.address.trim() || null,
      phoneNumber: formData.phoneNumber.trim() || null,
      website: formData.website.trim() || null,
    };

    if (isEditModalOpen && selectedCompany) {
      updateCompanyMutation.mutate({ id: selectedCompany.id, data: payload });
    } else {
      addCompanyMutation.mutate(payload);
    }
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      companyName: company.companyName,
      uenNumber: company.uenNumber,
      address: company.address ?? "",
      phoneNumber: company.phoneNumber ?? "",
      website: company.website ?? "",
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleView = (company: Company) => {
    setSelectedCompany(company);
    setIsViewModalOpen(true);
  };

  const handleDeleteClick = (company: Company) => {
    setSelectedCompany(company);
    setIsDeleteDialogOpen(true);
  };

  const closeFormSheet = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedCompany(null);
    resetForm();
  };

  const isFormSheetOpen = isAddModalOpen || isEditModalOpen;

  const filteredCompanies = companies.filter(
    (company: Company) =>
      company.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.uenNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.address ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderCompanyForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="companyName">Company Name *</Label>
        <Input
          id="companyName"
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          className={formErrors.companyName ? "border-destructive" : ""}
        />
        {formErrors.companyName && (
          <p className="text-sm text-destructive mt-1">{formErrors.companyName}</p>
        )}
      </div>

      <div>
        <Label htmlFor="uenNumber">UEN Number *</Label>
        <Input
          id="uenNumber"
          value={formData.uenNumber}
          onChange={(e) => setFormData({ ...formData, uenNumber: e.target.value })}
          className={formErrors.uenNumber ? "border-destructive" : ""}
        />
        {formErrors.uenNumber && (
          <p className="text-sm text-destructive mt-1">{formErrors.uenNumber}</p>
        )}
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <Input
          id="phoneNumber"
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          placeholder="https://example.com"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={closeFormSheet}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={addCompanyMutation.isPending || updateCompanyMutation.isPending}
        >
          {addCompanyMutation.isPending || updateCompanyMutation.isPending
            ? isEditModalOpen
              ? "Updating..."
              : "Saving..."
            : isEditModalOpen
              ? "Update Company"
              : "Save Company"}
        </Button>
      </div>
    </form>
  );

  return (
    <Dashboard
      title={<span className="text-[32px] font-bold">Company Management</span>}
      description="Manage your organization's company records."
    >
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-full sm:w-64"
            />
          </div>
          <Button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Companies</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading companies...</div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No companies found. Click &quot;Add Company&quot; to create one.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>UEN Number</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company: Company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.companyName}</TableCell>
                      <TableCell>{company.uenNumber}</TableCell>
                      <TableCell>
                        {company.address ? (
                          <div className="flex items-start gap-1 max-w-[200px]">
                            <MapPin className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
                            <span className="text-sm">{company.address}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {company.phoneNumber ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                            {company.phoneNumber}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {company.website ? (
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                            <a
                              href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline truncate max-w-[150px]"
                            >
                              {company.website}
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TableRowActions
                          actions={[
                            {
                              icon: Eye,
                              label: "View",
                              variant: "view",
                              onClick: () => handleView(company),
                            },
                            {
                              icon: Edit,
                              label: "Edit",
                              variant: "edit",
                              onClick: () => handleEdit(company),
                            },
                            {
                              icon: Trash2,
                              label: "Delete",
                              variant: "delete",
                              onClick: () => handleDeleteClick(company),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={isFormSheetOpen}
        onOpenChange={(open) => {
          if (!open) closeFormSheet();
        }}
      >
        <SheetContent
          side="right"
          className="p-0 flex flex-col"
          style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
        >
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-gray-900">
                {isEditModalOpen ? "Edit Company" : "Add Company"}
              </SheetTitle>
              <p className="text-sm text-gray-600 mt-2">
                {isEditModalOpen
                  ? "Update company information"
                  : "Add a new company to your organization"}
              </p>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-24">
            {renderCompanyForm()}
          </div>
        </SheetContent>
      </Sheet>

      {selectedCompany && (
        <EntityViewSheet
          open={isViewModalOpen}
          onOpenChange={setIsViewModalOpen}
          title="Company Details"
          description="View complete company information"
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedCompany(null);
          }}
        >
          <EntityViewSection title="Company Information">
            <EntityViewFieldGrid>
              <EntityViewField label="Company Name" value={selectedCompany.companyName} />
              <EntityViewField label="UEN Number" value={selectedCompany.uenNumber} />
              <EntityViewField label="Phone Number" value={formatViewValue(selectedCompany.phoneNumber)} />
              <EntityViewField label="Website">
                {selectedCompany.website ? (
                  <a
                    href={
                      selectedCompany.website.startsWith("http")
                        ? selectedCompany.website
                        : `https://${selectedCompany.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {selectedCompany.website}
                  </a>
                ) : (
                  "—"
                )}
              </EntityViewField>
              <EntityViewField
                label="Address"
                value={formatViewValue(selectedCompany.address)}
                fullWidth
              />
            </EntityViewFieldGrid>
          </EntityViewSection>
        </EntityViewSheet>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedCompany?.companyName}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedCompany && deleteCompanyMutation.mutate(selectedCompany.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dashboard>
  );
}
