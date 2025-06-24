import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Eye, Mail, Download, DollarSign, Clock, CheckCircle, XCircle } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Customer } from "@shared/schema";
import InvoiceForm from "@/components/forms/InvoiceForm";

// Format currency helper
const formatCurrency = (cents: number, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
};

// Format date helper
const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString();
};

// Get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "sent": return "bg-blue-100 text-blue-800";
    case "overdue": return "bg-red-100 text-red-800";
    case "cancelled": return "bg-gray-100 text-gray-800";
    default: return "bg-yellow-100 text-yellow-800"; // draft
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

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to send invoice");
      }
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
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to download PDF.",
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
  const overdueInvoices = invoices.filter(inv => inv.status === "overdue").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Create, manage, and track your invoices
          </p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingInvoice(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInvoice ? "Edit Invoice" : "Create New Invoice"}
              </DialogTitle>
              <DialogDescription>
                {editingInvoice
                  ? "Update invoice details."
                  : "Create a new invoice for your customer."}
              </DialogDescription>
            </DialogHeader>
            <InvoiceForm
              invoice={editingInvoice}
              customers={customers}
              onSuccess={handleFormSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search invoices..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(paidAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueInvoices}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const customer = customers.find(c => c.id === invoice.customerId);
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{customer?.name}</div>
                        {customer?.company && (
                          <div className="text-sm text-muted-foreground">
                            {customer.company}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>{formatCurrency(invoice.totalAmount, invoice.currency)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(invoice.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(invoice.status)}
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(invoice)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPdfMutation.mutate(invoice.id)}
                          disabled={downloadPdfMutation.isPending}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        {invoice.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendEmailMutation.mutate(invoice.id)}
                            disabled={sendEmailMutation.isPending}
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No invoices found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? "Try adjusting your search terms." : "Get started by creating your first invoice."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}