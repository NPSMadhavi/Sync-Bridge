import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, NumberInput } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { SimpleDatePicker } from "@/components/ui/simple-date-picker";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Invoice, Customer } from "@shared/schema";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
});

const invoiceFormSchema = z.object({
  customerId: z.number().min(1, "Customer is required"),
  issueDate: z.date(),
  dueDate: z.date(),
  taxRate: z.number().min(0).max(10000),
  discountRate: z.number().min(0).max(10000),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  invoice?: Invoice | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function InvoiceForm({ invoice, onSuccess, onCancel }: InvoiceFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customerId: invoice?.customerId || 0,
      issueDate: invoice ? new Date(invoice.issueDate) : new Date(),
      dueDate: invoice ? new Date(invoice.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      taxRate: invoice ? (invoice.taxRate || 0) / 100 : 9, // Default 9% GST for Singapore
      discountRate: invoice ? (invoice.discountRate || 0) / 100 : 0,
      paymentTerms: invoice?.paymentTerms || "Net 30 days",
      notes: invoice?.notes || "",
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");
  const taxRate = form.watch("taxRate");
  const discountRate = form.watch("discountRate");

  // Calculate totals
  const subtotal = watchedItems.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice * 100); // Convert to cents
  }, 0);

  const discountAmount = Math.round(subtotal * (discountRate / 100));
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * (taxRate / 100));
  const totalAmount = taxableAmount + taxAmount;

  const mutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      // Generate invoice number if creating new invoice
      const invoiceNumber = invoice ? invoice.invoiceNumber : `INV-${Date.now()}`;
      
      const invoiceData = {
        invoiceNumber,
        customerId: data.customerId,
        issueDate: data.issueDate.toISOString(),
        dueDate: data.dueDate.toISOString(),
        taxRate: Math.round(data.taxRate * 100), // Convert to basis points
        discountRate: Math.round(data.discountRate * 100),
        paymentTerms: data.paymentTerms,
        notes: data.notes,
        subtotal: Math.round(subtotal),
        taxAmount: Math.round(taxAmount),
        discountAmount: Math.round(discountAmount),
        totalAmount: Math.round(totalAmount),
        balanceAmount: Math.round(totalAmount),
        paidAmount: 0, // New invoices start with 0 paid amount
        currency: 'USD',
        status: 'draft',
        items: data.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice * 100), // Convert to cents
          totalPrice: Math.round(item.quantity * item.unitPrice * 100),
        })),
      };

      const url = invoice ? `/api/invoices/${invoice.id}` : "/api/invoices";
      const method = invoice ? "PUT" : "POST";
      const response = await apiRequest(method, url, invoiceData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Success",
        description: `Invoice ${invoice ? "updated" : "created"} successfully.`,
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${invoice ? "update" : "create"} invoice.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InvoiceFormData) => {
    mutation.mutate(data);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer *</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  value={field.value.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name} {customer.company && `(${customer.company})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paymentTerms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Terms</FormLabel>
                <FormControl>
                  <Input placeholder="Net 30" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="issueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Date *</FormLabel>
                <FormControl>
                  <SimpleDatePicker
                    date={field.value}
                    setDate={field.onChange}
                    placeholder="Select issue date"
                    max={new Date().toISOString().split('T')[0]}
                    min="1900-01-01"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date *</FormLabel>
                <FormControl>
                  <SimpleDatePicker
                    date={field.value}
                    setDate={field.onChange}
                    placeholder="Select due date"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GST Rate (%)</FormLabel>
                <FormControl>
                  <NumberInput
                    step="0.01"
                    placeholder="9.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 9)}
                  />
                </FormControl>
                <FormDescription>Singapore GST rate (default 9%)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discountRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount Rate (%)</FormLabel>
                <FormControl>
                  <NumberInput
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Invoice Items */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Invoice Items</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-12 md:col-span-5">
                <FormField
                  control={form.control}
                  name={`items.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Item description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-4 md:col-span-2">
                <FormField
                  control={form.control}
                  name={`items.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qty</FormLabel>
                      <FormControl>
                        <NumberInput
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-4 md:col-span-3">
                <FormField
                  control={form.control}
                  name={`items.${index}.unitPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Price</FormLabel>
                      <FormControl>
                        <NumberInput
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <FormLabel>Total</FormLabel>
                <div className="text-sm font-medium py-2">
                  {formatCurrency((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unitPrice || 0) * 100)}
                </div>
              </div>

              <div className="col-span-2 md:col-span-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Invoice Totals */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="space-y-2 max-w-sm ml-auto">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount ({discountRate}%):</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between">
                <span>Tax ({taxRate}%):</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes for the invoice..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {invoice ? "Update Invoice" : "Create Invoice"}
          </Button>
        </div>
      </form>
    </Form>
  );
}