import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { FormSheetHeader } from "@/components/ui/form-sheet-header";
import { FormSheetFooter, formSheetCancelClass, formSheetSubmitClass } from "@/components/ui/form-sheet-footer";
import { Loader2, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { insertCustomerSchema, type Customer, type InsertCustomer } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface CustomerFormProps {
  customer?: Customer | null;
  onSuccess?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function CustomerForm({ customer, onSuccess, isOpen, onClose }: CustomerFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: {
      name: customer?.name || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      company: customer?.company || "",
      address: customer?.address || "",
      city: customer?.city || "",
      state: customer?.state || "",
      zipCode: customer?.zipCode || "",
      country: customer?.country || "",
      taxId: customer?.taxId || "",
      isActive: customer?.isActive ?? true,
      notes: customer?.notes || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertCustomer) => {
      const url = customer ? `/api/customers/${customer.id}` : "/api/customers";
      const method = customer ? "PUT" : "POST";

      // Strip tenantId — server sets it from middleware
      const { tenantId: _ignored, ...payload } = data as any;

      const response = await apiRequest(method, url, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Success",
        description: `Customer ${customer ? "updated" : "created"} successfully.`,
      });
      form.reset();
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${customer ? "update" : "create"} customer.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCustomer) => {
    mutation.mutate(data);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent hideClose className="!w-screen !max-w-none fixed top-0 right-0 h-screen z-50 p-0 flex flex-col overflow-hidden bg-white">
        <Form {...form}>
          <div className="h-full flex flex-col">
            <FormSheetHeader
              title={customer ? "Edit Customer" : "Add New Customer"}
              onClose={onClose}
              icon={<UserCheck className="h-5 w-5" />}
            />
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Company name" {...field} />
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
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="customer@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Tax identification number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Customer</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Enable this customer for invoicing
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="ZIP code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this customer..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </div>
              <FormSheetFooter>
                <Button
                  type="button"
                  variant="outline"
                  className={formSheetCancelClass}
                  onClick={onClose}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={formSheetSubmitClass}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {customer ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>{customer ? "Update " : "Create "}</>
                  )}
                </Button>
              </FormSheetFooter>
            </form>
          </div>
        </Form>
      </SheetContent>
    </Sheet>
  );
}