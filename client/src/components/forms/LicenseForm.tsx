import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { insertLicenseSchema, License, Asset } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isAfter, isBefore } from "date-fns";
import { CalendarIcon, Loader2, Shield, DollarSign, Users, Building, RotateCcw, CheckCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";

// Extend the insertLicenseSchema with enhanced validations
const licenseFormSchema = insertLicenseSchema.extend({
  name: z.string().min(1, "Name is required"),
  licenseKey: z.string()
    .min(1, "License key is required")
    .regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})?$|^[A-Z0-9\-]{10,}$/, "License key must follow format XXXX-XXXX-XXXX or similar pattern"),
  type: z.enum(["software", "hardware", "subscription", "service", "other"]),
  assetId: z.number().nullable().optional(),
  purchaseDate: z.date().optional().nullable(),
  expiryDate: z.date().optional().nullable(),
  cost: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\d+(\.\d{1,2})?$/.test(val), "Cost must be a valid decimal number"),
  seats: z.number().int().min(1, "Seats must be at least 1").optional().nullable(),
  notes: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  renewalCycle: z.enum(["none", "monthly", "yearly", "custom"]).optional().nullable(),
  status: z.enum(["active", "expired", "revoked", "assigned"]).optional().nullable(),
}).refine((data) => {
  // Validate that expiry date is after purchase date
  if (data.purchaseDate && data.expiryDate) {
    return isAfter(data.expiryDate, data.purchaseDate);
  }
  return true;
}, {
  message: "Expiry date must be after purchase date",
  path: ["expiryDate"],
});

type LicenseFormValues = z.infer<typeof licenseFormSchema>;

interface LicenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  license?: License;
}

export default function LicenseForm({
  isOpen,
  onClose,
  license,
}: LicenseFormProps) {
  const { toast } = useToast();
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
    license?.assetId || null
  );
  const [assetSearchOpen, setAssetSearchOpen] = useState(false);

  // Fetch all assets for the asset selection
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  // Initialize form with default values or existing license data
  const form = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: {
      name: license?.name || "",
      licenseKey: license?.licenseKey || "",
      type: license?.type || "software",
      assetId: license?.assetId || null,
      purchaseDate: license?.purchaseDate ? new Date(license.purchaseDate) : null,
      expiryDate: license?.expiryDate ? new Date(license.expiryDate) : null,
      cost: license?.cost || "",
      seats: license?.seats || null,
      notes: license?.notes || "",
      vendor: license?.vendor || "",
      renewalCycle: license?.renewalCycle || "none",
      status: license?.status || "active",
    },
  });

  const isEditMode = !!license;

  // Check if license is expired
  const isExpired = form.watch("expiryDate") && isBefore(form.watch("expiryDate")!, new Date());

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  // Create license mutation
  const createMutation = useMutation({
    mutationFn: async (values: LicenseFormValues) => {
      const res = await apiRequest("POST", "/api/licenses", values);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "License created",
        description: "The license has been created successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create license: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update license mutation
  const updateMutation = useMutation({
    mutationFn: async (values: LicenseFormValues) => {
      const res = await apiRequest(
        "PUT",
        `/api/licenses/${license?.id}`,
        values
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "License updated",
        description: "The license has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update license: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: LicenseFormValues) => {
    // Auto-set status to expired if expiry date has passed
    const updatedValues = { ...values };
    if (values.expiryDate && isBefore(values.expiryDate, new Date())) {
      updatedValues.status = "expired";
    }

    if (license) {
      updateMutation.mutate(updatedValues);
    } else {
      createMutation.mutate(updatedValues);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right"
        className="w-full max-w-none p-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <TooltipProvider>
          <Form {...form}>
            <div className="h-full flex flex-col">
              {/* Header */}
              <SheetHeader className="flex-shrink-0 px-6 py-4 border-b bg-background">
                <SheetTitle className="flex items-center gap-2 text-xl">
                  <Shield className="h-5 w-5 text-primary" />
                  {isEditMode ? "Edit License" : "Create New License"}
                  {isExpired && (
                    <span className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded-full">
                      Expired
                    </span>
                  )}
                </SheetTitle>
              </SheetHeader>

              {/* Form Content - Scrollable Area */}
              <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
                {/* Responsive grid layout container */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                  {/* Left Column */}
                  <div className="space-y-6">
                    
                    {/* License Information Section */}
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Shield className="h-4 w-4" />
                          License Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          {/* Name */}
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>License Name*</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="e.g., Microsoft Office 365" 
                                    {...field} 
                                    autoFocus
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Enter the software or service name
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Type */}
                          <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>License Type*</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="software">Software</SelectItem>
                                    <SelectItem value="hardware">Hardware</SelectItem>
                                    <SelectItem value="subscription">Subscription</SelectItem>
                                    <SelectItem value="service">Service</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription className="text-xs">
                                  Category of license
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* License Key */}
                          <FormField
                            control={form.control}
                            name="licenseKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>License Key*</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., ABCD-1234-EFGH-5678"
                                    {...field}
                                    className="font-mono text-sm"
                                    onChange={(e) => {
                                      // Auto-format license key to uppercase and add hyphens
                                      let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                                      if (value.length > 4) {
                                        value = value.match(/.{1,4}/g)?.join('-') || value;
                                      }
                                      field.onChange(value);
                                    }}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  License key format: XXXX-XXXX-XXXX-XXXX (auto-formatted)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Status */}
                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value || "active"}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="active">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="h-3 w-3 text-green-600" />
                                        Active
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="expired">
                                      <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-red-600"></span>
                                        Expired
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="revoked">
                                      <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-gray-600"></span>
                                        Revoked
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="assigned">
                                      <div className="flex items-center gap-2">
                                        <Users className="h-3 w-3 text-blue-600" />
                                        Assigned
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription className="text-xs">
                                  Current license status
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </CardContent>
                    </Card>
                    
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">

                    {/* Finance & Dates Section */}
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <DollarSign className="h-4 w-4" />
                          Finance & Dates
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">

                          {/* Cost */}
                          <FormField
                            control={form.control}
                            name="cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>License Cost (SGD)</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="299.99"
                                      inputMode="decimal"
                                      className="pl-10"
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </div>
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Total cost paid for this license in Singapore Dollars
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Purchase Date */}
                          <FormField
                            control={form.control}
                            name="purchaseDate"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Purchase Date</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant={"outline"}
                                        className={cn(
                                          "w-full pl-3 text-left font-normal",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value ? (
                                          format(field.value, "PPP")
                                        ) : (
                                          <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value || undefined}
                                      onSelect={field.onChange}
                                      disabled={(date) =>
                                        date > new Date() || date < new Date("1900-01-01")
                                      }
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormDescription className="text-xs">
                                  When was this license purchased or acquired
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Expiry Date */}
                          <FormField
                            control={form.control}
                            name="expiryDate"
                            render={({ field }) => {
                              const isExpiredLicense = field.value && isBefore(field.value, new Date());
                              const purchaseDate = form.watch("purchaseDate");
                              
                              return (
                                <FormItem className="flex flex-col">
                                  <FormLabel className="flex items-center gap-2">
                                    Expiry Date
                                    {isExpiredLicense && (
                                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                                        Expired
                                      </span>
                                    )}
                                  </FormLabel>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <FormControl>
                                        <Button
                                          variant={"outline"}
                                          className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground",
                                            isExpiredLicense && "border-red-500 bg-red-50 text-red-700"
                                          )}
                                        >
                                          {field.value ? (
                                            format(field.value, "PPP")
                                          ) : (
                                            <span>Pick a date</span>
                                          )}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                      </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                        mode="single"
                                        selected={field.value || undefined}
                                        onSelect={field.onChange}
                                        disabled={(date) => {
                                          return date < new Date("1900-01-01") || 
                                                 (purchaseDate && isBefore(date, purchaseDate));
                                        }}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                  <FormDescription className={cn(
                                    "text-xs",
                                    isExpiredLicense && "text-red-600"
                                  )}>
                                    {isExpiredLicense 
                                      ? "This license has expired and will be marked as expired"
                                      : "When does this license expire (must be after purchase date)"
                                    }
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                      </CardContent>
                    </Card>

                    {/* Assignment Section */}
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Users className="h-4 w-4" />
                          Assignment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">

                        {/* Associated Asset - Searchable */}
                        <FormField
                          control={form.control}
                          name="assetId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Associated Asset</FormLabel>
                              <Popover open={assetSearchOpen} onOpenChange={setAssetSearchOpen}>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={assetSearchOpen}
                                      className="w-full justify-between"
                                    >
                                      {field.value && field.value !== null
                                        ? (() => {
                                            const selectedAsset = assets.find(asset => asset.id === field.value);
                                            return selectedAsset 
                                              ? `${selectedAsset.tag} - ${selectedAsset.type} (${selectedAsset.brand} ${selectedAsset.model})`
                                              : "None";
                                          })()
                                        : "Select asset (optional)..."}
                                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                  <Command>
                                    <CommandInput placeholder="Search assets..." />
                                    <CommandEmpty>No asset found.</CommandEmpty>
                                    <CommandGroup className="max-h-64 overflow-auto">
                                      <CommandItem
                                        value="none"
                                        onSelect={() => {
                                          field.onChange(null);
                                          setSelectedAssetId(null);
                                          setAssetSearchOpen(false);
                                        }}
                                      >
                                        <CheckCircle
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === null ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        None
                                      </CommandItem>
                                      {assets.map((asset) => (
                                        <CommandItem
                                          key={asset.id}
                                          value={`${asset.tag} ${asset.type} ${asset.brand} ${asset.model}`}
                                          onSelect={() => {
                                            field.onChange(asset.id);
                                            setSelectedAssetId(asset.id);
                                            setAssetSearchOpen(false);
                                          }}
                                        >
                                          <CheckCircle
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === asset.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex flex-col">
                                            <span className="font-medium">{asset.tag} - {asset.type}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {asset.brand} {asset.model}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <FormDescription className="text-xs">
                                Link this license to a specific device or hardware asset
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Seats */}
                        <FormField
                          control={form.control}
                          name="seats"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Seats</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="1000"
                                  placeholder="e.g., 5"
                                  {...field}
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const value = e.target.value ? parseInt(e.target.value) : null;
                                    field.onChange(value);
                                  }}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Number of users licensed to use this software
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                    
                  </div>
                </div>

                {/* Additional Info Section - Full Width */}
                <div className="mt-8 col-span-full">
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building className="h-4 w-4" />
                        Additional Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                      {/* Vendor */}
                      <FormField
                        control={form.control}
                        name="vendor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vendor</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Microsoft, Adobe, Oracle"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Software vendor or license provider
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Renewal Cycle */}
                      <FormField
                        control={form.control}
                        name="renewalCycle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Renewal Cycle</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value || "none"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select renewal cycle" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">
                                  <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full bg-gray-400"></span>
                                    One-time Purchase
                                  </div>
                                </SelectItem>
                                <SelectItem value="monthly">
                                  <div className="flex items-center gap-2">
                                    <RotateCcw className="h-3 w-3 text-blue-600" />
                                    Monthly
                                  </div>
                                </SelectItem>
                                <SelectItem value="yearly">
                                  <div className="flex items-center gap-2">
                                    <RotateCcw className="h-3 w-3 text-green-600" />
                                    Yearly
                                  </div>
                                </SelectItem>
                                <SelectItem value="custom">
                                  <div className="flex items-center gap-2">
                                    <RotateCcw className="h-3 w-3 text-purple-600" />
                                    Custom
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-xs">
                              How often this license needs to be renewed
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Notes - Full Width */}
                      <div className="lg:col-span-2">
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Additional information about this license..."
                                  className="min-h-[100px]"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Any additional details, terms, or special conditions
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Sticky Footer with Actions - Outside scrollable area */}
              <div className="flex-shrink-0 bg-background border-t px-6 py-4">
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="flex flex-col sm:flex-row justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto min-w-[120px]"
                      onClick={() => {
                        form.reset();
                        onClose();
                      }}
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="w-full sm:w-auto min-w-[140px]"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isEditMode ? "Update License" : "Create License"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </Form>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}