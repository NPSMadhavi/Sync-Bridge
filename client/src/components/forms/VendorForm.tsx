import { useState, useEffect } from "react";
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
  FormDescription,
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
import { Loader2, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { insertVendorSchema, type Vendor, type InsertVendor } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

// Extend schema for validation
const formSchema = insertVendorSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  contact: z.string().min(5, "Contact details required"),
  email: z.string().email("Please enter a valid email address"),
});

type VendorFormData = z.infer<typeof formSchema>;

interface VendorFormProps {
  vendor?: Vendor | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function VendorForm({ vendor, isOpen, onClose }: VendorFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditMode] = useState(!!vendor);

  const form = useForm<VendorFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      contact: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      taxId: "",
      registrationNumber: "",
      assetTypesSupplied: "",
      paymentTerms: "",
      creditLimit: "",
      isActive: true,
      notes: "",
    },
  });

  // Reset form when vendor changes
  useEffect(() => {
    if (vendor) {
      form.reset({
        name: vendor.name,
        contact: vendor.contact,
        email: vendor.email,
        phone: vendor.phone || "",
        website: vendor.website || "",
        address: vendor.address || "",
        city: vendor.city || "",
        state: vendor.state || "",
        zipCode: vendor.zipCode || "",
        country: vendor.country || "",
        taxId: vendor.taxId || "",
        registrationNumber: vendor.registrationNumber || "",
        assetTypesSupplied: vendor.assetTypesSupplied || "",
        paymentTerms: vendor.paymentTerms || "",
        creditLimit: vendor.creditLimit || "",
        isActive: vendor.isActive ?? true,
        notes: vendor.notes || "",
      });
    } else {
      form.reset({
        name: "",
        contact: "",
        email: "",
        phone: "",
        website: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
        taxId: "",
        registrationNumber: "",
        assetTypesSupplied: "",
        paymentTerms: "",
        creditLimit: "",
        isActive: true,
        notes: "",
      });
    }
  }, [vendor, form]);

  const mutation = useMutation({
    mutationFn: async (data: VendorFormData) => {
      const url = vendor ? `/api/vendors/${vendor.id}` : "/api/vendors";
      const method = vendor ? "PUT" : "POST";
      
      // Add tenant ID to the request
      const tenantId = localStorage.getItem("tenantId");
      if (!tenantId) {
        throw new Error("No tenant ID found");
      }

      const response = await apiRequest(method, url, {
        ...data,
        tenantId: parseInt(tenantId, 10)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({
        title: "Success",
        description: `Vendor ${vendor ? "updated" : "created"} successfully.`,
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${vendor ? "update" : "create"} vendor.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VendorFormData) => {
    mutation.mutate(data);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent hideClose style={{ width: '50vw', maxWidth: 'none', minWidth: '320px' }} className="fixed top-0 right-0 h-screen z-50 p-0 flex flex-col overflow-hidden bg-white">
        <Form {...form}>
          <div className="h-full flex flex-col">
            <FormSheetHeader
              title={isEditMode ? "Edit Vendor" : "Add New Vendor"}
              onClose={onClose}
              icon={<Store className="h-5 w-5" />}
            />
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name *</FormLabel>
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
                        <FormLabel>Contact Person *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
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
                          <Input type="email" placeholder="contact@abcsupplies.com" {...field} />
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
                          <Input placeholder="+1 (555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.abcsupplies.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 md:col-span-2">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active Vendor</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Enable this vendor for purchases
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

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="123 Business St" className="resize-none" rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
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
                          <Input placeholder="NY" {...field} />
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
                          <Input placeholder="10001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="United States" {...field} />
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
                          <Input placeholder="12-3456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="registrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number</FormLabel>
                        <FormControl>
                          <Input placeholder="REG123456" {...field} />
                        </FormControl>
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
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit</FormLabel>
                        <FormControl>
                          <Input placeholder="$50,000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                <FormField
                  control={form.control}
                  name="assetTypesSupplied"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Asset Types Supplied</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Laptops, Monitors, Mobile Phones, Networking Equipment"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        List the types of assets this vendor supplies
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this vendor..."
                          className="resize-none"
                          rows={3}
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
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>{isEditMode ? "Update " : "Create "}</>
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