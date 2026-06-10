import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Eye, Mail, Download, DollarSign, Clock, CheckCircle, XCircle, X, Palette, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TableRowActions } from "@/components/ui/table-row-actions";
import type { Invoice, Customer } from "@shared/schema";
import InvoiceForm from "@/components/forms/InvoiceForm";
import Dashboard from "@/components/layout/Dashboard";
import { getQueryFn } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import React, { useEffect } from "react";

// Format currency helper
const formatCurrency = (cents: number, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(cents / 100);
};

// Get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case "paid": return "bg-green-500/20 text-green-400 border-green-500/20";
    case "sent": return "bg-blue-500/20 text-blue-400 border-blue-500/20";
    case "overdue": return "bg-red-500/20 text-red-400 border-red-500/20";
    case "cancelled": return "bg-gray-500/20 text-gray-400 border-gray-500/20";
    default: return "bg-yellow-500/20 text-yellow-400 border-yellow-500/20"; // draft
  }
};

// Get status icon
const getStatusIcon = (status: string) => {
  switch (status) {
    case "paid": return <CheckCircle className="h-4 w-4" />;
    case "sent": return <Mail className="h-4 w-4" />;
    case "overdue": return <Clock className="h-4 w-4" />;
    case "cancelled": return <XCircle className="h-4 w-4" />;
    default: return <Edit className="h-4 w-4" />; // draft
  }
};

function CustomizeInvoiceDesignForm({ invoiceId, onClose }: { invoiceId: number, onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [design, setDesign] = useState<any>({
    primaryColor: "#0891b2",
    fontFamily: "Arial, sans-serif",
    fontSize: "medium",
    logoUrl: "",
    headerNote: "",
    footerNote: "",
    templateStyle: "classic",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  // Font options
  const fontOptions = [
    { label: "Arial", value: "Arial, sans-serif" },
    { label: "Roboto", value: "Roboto, sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Times New Roman", value: "'Times New Roman', serif" },
    { label: "Courier New", value: "'Courier New', monospace" },
  ];
  const fontSizeOptions = [
    { label: "Small", value: "small" },
    { label: "Medium", value: "medium" },
    { label: "Large", value: "large" },
  ];
  const templateOptions = [
    { label: "Classic", value: "classic" },
    { label: "Minimal", value: "minimal" },
    { label: "Modern", value: "modern" },
  ];

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiRequest('GET', `/api/invoices/designs/${invoiceId}`)
      .then(res => res.json())
      .then(data => {
        if (data) setDesign({ ...design, ...data });
        if (data?.logoUrl) setLogoPreview(data.logoUrl);
        setLoading(false);
      })
      .catch(err => {
        setError("Failed to load design");
        setLoading(false);
      });
    // eslint-disable-next-line
  }, [invoiceId]);

  // Handle logo upload preview
  useEffect(() => {
    if (logoFile) {
      const reader = new FileReader();
      reader.onload = e => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(logoFile);
    }
  }, [logoFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "file") {
      const file = (e.target as HTMLInputElement).files?.[0] || null;
      setLogoFile(file);
      return;
    }
    setDesign((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let logoUrl = design.logoUrl;
    // If a new logo file is selected, upload it first
    if (logoFile) {
      const formData = new FormData();
      formData.append("file", logoFile);
      const uploadRes = await apiRequest('POST', "/api/upload", formData);
      const { url } = await uploadRes.json();
      logoUrl = url;
    }
    // Save design
    await apiRequest('POST', `/api/invoices/designs/${invoiceId}`, { ...design, logoUrl });
    setSaving(false);
    onClose();
  };

  // Live preview style
  const previewStyle: React.CSSProperties = {
    fontFamily: design.fontFamily,
    fontSize: design.fontSize === "small" ? "14px" : design.fontSize === "large" ? "20px" : "16px",
    border: `2px solid ${design.primaryColor}`,
    borderRadius: 8,
    padding: 24,
    marginTop: 24,
    background: "#fff",
    maxWidth: 480,
    marginLeft: "auto",
    marginRight: "auto",
  };

  if (loading) return <div className="py-8 text-center">Loading design...</div>;
  if (error) return <div className="py-8 text-center text-red-600">{error}</div>;

  return (
    <form onSubmit={handleSave} className="max-w-xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Primary Color</label>
          <input type="color" name="primaryColor" value={design.primaryColor} onChange={handleChange} className="w-12 h-8 p-0 border-none bg-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Font Family</label>
          <select name="fontFamily" value={design.fontFamily} onChange={handleChange} className="w-full border rounded p-2">
            {fontOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Font Size</label>
          <select name="fontSize" value={design.fontSize} onChange={handleChange} className="w-full border rounded p-2">
            {fontSizeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Logo Upload</label>
          <input type="file" name="logo" accept="image/*" onChange={handleChange} />
          {logoPreview && <img src={logoPreview} alt="Logo Preview" className="mt-2 h-12" />}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Header Note</label>
        <textarea name="headerNote" value={design.headerNote} onChange={handleChange} className="w-full border rounded p-2 min-h-[48px]" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Footer Note</label>
        <textarea name="footerNote" value={design.footerNote} onChange={handleChange} className="w-full border rounded p-2 min-h-[48px]" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Template Style</label>
        <select name="templateStyle" value={design.templateStyle} onChange={handleChange} className="w-full border rounded p-2">
          {templateOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </div>
      {/* Live Preview */}
      <div className="mt-8">
        <div className="text-lg font-semibold mb-2 text-center">Live Preview</div>
        <div style={previewStyle}>
          {logoPreview && <img src={logoPreview} alt="Logo" style={{ maxHeight: 48, marginBottom: 12 }} />}
          <div style={{ color: design.primaryColor, fontWeight: 700, fontSize: 24, marginBottom: 8 }}>INVOICE</div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>INV-{invoiceId}</div>
          {design.headerNote && <div style={{ marginBottom: 12, color: design.primaryColor }}>{design.headerNote}</div>}
          <div style={{ margin: '16px 0', borderTop: `1px solid ${design.primaryColor}` }} />
          <div style={{ marginBottom: 8 }}>Customer Name</div>
          <div style={{ marginBottom: 8 }}>Issue Date: 2024-01-01</div>
          <div style={{ marginBottom: 8 }}>Due Date: 2024-01-31</div>
          <div style={{ marginBottom: 8 }}>Amount: $1,234.56</div>
          <div style={{ margin: '16px 0', borderTop: `1px solid ${design.primaryColor}` }} />
          {design.footerNote && <div style={{ marginTop: 12, color: design.primaryColor }}>{design.footerNote}</div>}
        </div>
      </div>
    </form>
  );
}

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [customizeDesignInvoiceId, setCustomizeDesignInvoiceId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Fetch customers based on user role
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: user?.role === 'vendor' ? ['/api/vendor/customers', user?.email] : ["/api/customers"],
    queryFn: async () => {
      if (user?.role === 'vendor') {
        // For vendors, fetch vendor customers
        const response = await apiRequest('GET', `/api/vendor/customers?vendorEmail=${user.email}`);
        const vendorCustomers = await response.json();
        // Transform vendor customers to match Customer interface
        return vendorCustomers.map((vc: any) => ({
          id: vc.id,
          tenantId: 0, // Vendor customers don't have tenantId
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
          createdAt: vc.createdAt,
        }));
      } else {
        // For regular users, fetch tenant customers
        const response = await apiRequest('GET', '/api/customers');
        return response.json();
      }
    },
    enabled: !!user,
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await apiRequest('POST', `/api/invoices/${invoiceId}/send`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Success",
        description: "Invoice sent successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invoice.",
        variant: "destructive",
      });
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      // Use raw fetch so we can handle binary PDF response correctly
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to download PDF");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    },
    onSuccess: () => {
      toast({ title: "Downloaded", description: "Invoice PDF downloaded successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to download PDF.", variant: "destructive" });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      await apiRequest('DELETE', `/api/invoices/${invoiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Success",
        description: "Invoice deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice.",
        variant: "destructive",
      });
    },
  });

  const filteredInvoices = invoices.filter((invoice) => {
    const customer = customers.find(c => c.id === invoice.customerId);
    return (
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingInvoice(null);
  };

  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const paidAmount = invoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + inv.totalAmount, 0);
  const overdueCount = invoices.filter(inv => inv.status === "overdue").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Dashboard title="Invoices" description="Manage your invoices and billing.">
      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex justify-end">
          <Button onClick={() => { setEditingInvoice(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-teal-400 to-teal-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Total Invoices</h3>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalInvoices}</p>
              <p className="text-xs text-muted-foreground mt-1">All invoices</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-teal-500 to-teal-700">
                <DollarSign className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Total Amount</h3>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1">Gross amount</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-green-400 to-green-600">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Paid Amount</h3>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(paidAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1">Received payments</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 bg-gradient-to-r from-red-400 to-red-600">
                <Clock className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Overdue</h3>
              </div>
              <p className="text-2xl font-bold text-foreground">{overdueCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Past due date</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Invoice Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const customer = customers.find(c => c.id === invoice.customerId);
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer?.name || "Unknown"}</div>
                          {customer?.company && (
                            <div className="text-sm text-muted-foreground">{customer.company}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(invoice.issueDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>
                          <div className="flex items-center">
                            {getStatusIcon(invoice.status)}
                            <span className="ml-1 capitalize">{invoice.status}</span>
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TableRowActions
                          actions={[
                            {
                              icon: Edit,
                              label: "Edit",
                              variant: "edit",
                              onClick: () => handleEdit(invoice),
                            },
                            {
                              icon: Download,
                              label: "Download PDF",
                              variant: "default",
                              disabled: downloadPdfMutation.isPending,
                              onClick: () => downloadPdfMutation.mutate(invoice.id),
                            },
                            ...(invoice.status !== "paid"
                              ? [{
                                  icon: Mail,
                                  label: "Send Email",
                                  variant: "default" as const,
                                  onClick: () => sendEmailMutation.mutate(invoice.id),
                                }]
                              : []),
                            {
                              icon: Palette,
                              label: "Customize Design",
                              variant: "default",
                              onClick: () => setCustomizeDesignInvoiceId(invoice.id),
                            },
                            {
                              icon: Trash2,
                              label: "Delete Invoice",
                              variant: "delete",
                              disabled: deleteInvoiceMutation.isPending,
                              onClick: () => deleteInvoiceMutation.mutate(invoice.id),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filteredInvoices.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No invoices found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm ? "Try adjusting your search terms." : "Get started by creating your first invoice."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Form Sheet */}
      {showForm && (
        <Sheet open={showForm} onOpenChange={setShowForm}>
          <SheetContent side="right" style={{ width: '50vw', maxWidth: 'none', minWidth: '320px' }} className="fixed top-0 right-0 h-screen z-50 p-0 flex flex-col bg-card">
            <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0 flex items-center justify-between">
              <SheetHeader className="flex-row flex-1 justify-between items-center">
                <SheetTitle>
                  {editingInvoice ? "Edit Invoice" : "Create New Invoice"}
                </SheetTitle>
              </SheetHeader>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-24">
              <InvoiceForm
                invoice={editingInvoice}
                onSuccess={handleFormSuccess}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Customize Design Drawer */}
      {typeof customizeDesignInvoiceId === 'number' && !isNaN(customizeDesignInvoiceId) && (
        <Sheet open={!!customizeDesignInvoiceId} onOpenChange={open => { if (!open) setCustomizeDesignInvoiceId(null); }}>
          <SheetContent side="right" style={{ width: '50vw', maxWidth: 'none', minWidth: '320px' }} className="fixed top-0 right-0 h-screen z-50 p-0 flex flex-col bg-card">
            <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0 flex items-center justify-between">
              <SheetHeader className="flex-row flex-1 justify-between items-center">
                <SheetTitle>
                  {(() => {
                    const inv = invoices.find(i => i.id === customizeDesignInvoiceId);
                    return inv ? `Customize Invoice Design – INV-${inv.invoiceNumber}` : 'Customize Invoice Design';
                  })()}
                </SheetTitle>
              </SheetHeader>
              <Button variant="ghost" size="sm" onClick={() => setCustomizeDesignInvoiceId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-24">
              <CustomizeInvoiceDesignForm invoiceId={customizeDesignInvoiceId} onClose={() => setCustomizeDesignInvoiceId(null)} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Dashboard>
  );
}