import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssetSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Package, 
  User, 
  CreditCard, 
  Calculator,
  FileText,
  HelpCircle
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Asset types for dropdown
const assetTypes = [
  "Laptop", "Desktop", "Monitor", "Phone", "Tablet", "Server", 
  "Printer", "Scanner", "Router", "Switch", "Projector", "Camera", "Other"
];

// Manufacturers for dropdown
const manufacturers = [
  "Apple", "Dell", "HP", "Lenovo", "Microsoft", "Samsung", "LG", 
  "Asus", "Acer", "Canon", "Epson", "Cisco", "Netgear", "Other"
];

// Locations for dropdown
const locations = [
  "Headquarters", "Branch Office", "Remote", "Warehouse", "IT Room", 
  "Conference Room", "Reception", "Other"
];

// Depreciation methods
const depreciationMethods = [
  "Straight Line", "Reducing Balance", "Sum of Years Digits"
];

// Enhanced form schema with better validation
const formSchema = insertAssetSchema.extend({
  tag: z.string().min(3, "Asset tag must be at least 3 characters"),
  type: z.string().min(1, "Asset type is required"),
  serial: z.string().min(1, "Serial number is required"),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  condition: z.string().optional(),
  assignedTo: z.string().optional(),
  location: z.string().optional(),
  vendor: z.string().optional(),
  invoiceNumber: z.string().optional(),
  purchaseDate: z.date().optional(),
  warrantyExpiryDate: z.date().optional(),
  depreciationStartDate: z.date().optional(),
  usefulLifeYears: z.number().min(1).max(20).optional(),
  depreciationMethod: z.string().optional(),
  description: z.string().optional(),
});

type AssetFormData = z.infer<typeof formSchema>;

interface AssetFormProps {
  assetId?: number;
  onSuccess?: () => void;
}

export default function AssetForm({ assetId, onSuccess }: AssetFormProps) {
  const { toast } = useToast();
  const [isEditMode] = useState(!!assetId);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
  
  // Fetch vendors for dropdown
  const { data: vendors = [] } = useQuery({
    queryKey: ["/api/vendors"],
  });
  
  // Fetch asset data if in edit mode
  const { data: assetData, isLoading: isLoadingAsset } = useQuery({
    queryKey: ["/api/assets", assetId],
    enabled: !!assetId,
  });
  
  const form = useForm<AssetFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tag: "",
      type: "",
      category: "",
      serial: "",
      model: "",
      manufacturer: "",
      status: "available",
      condition: "new",
      assignedTo: "",
      location: "",
      vendor: "",
      invoiceNumber: "",
      purchaseDate: undefined,
      warrantyExpiryDate: undefined,
      depreciationStartDate: undefined,
      usefulLifeYears: 3,
      depreciationMethod: "Straight Line",
      description: "",
      vendorId: undefined,
      cost: undefined,
    },
  });
  
  // Update form when asset data is loaded
  useEffect(() => {
    if (assetData) {
      form.reset({
        ...assetData,
        purchaseDate: assetData.purchaseDate ? new Date(assetData.purchaseDate) : undefined,
        warrantyExpiry: assetData.warrantyExpiry ? new Date(assetData.warrantyExpiry) : undefined,
      });
    }
  }, [assetData, form]);
  
  const createAssetMutation = useMutation({
    mutationFn: async (data: AssetFormData) => {
      const res = await apiRequest("POST", "/api/assets", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Asset created",
        description: "The asset has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      form.reset();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create asset",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const updateAssetMutation = useMutation({
    mutationFn: async (data: AssetFormData) => {
      const res = await apiRequest("PUT", `/api/assets/${assetId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Asset updated",
        description: "The asset has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets", assetId] });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update asset",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: AssetFormData) => {
    if (isEditMode) {
      updateAssetMutation.mutate(data);
    } else {
      createAssetMutation.mutate(data);
    }
  };
  
  if (isEditMode && isLoadingAsset) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  return (
    <TooltipProvider>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Two-column layout container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column */}
            <div className="space-y-6">
              
              {/* Basic Details Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-blue-600" />
                    Basic Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="tag"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            Asset Tag *
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-3 w-3 text-gray-400" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Unique identifier for tracking this asset</p>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="IT-LAP-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select asset type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {assetTypes.map((type) => (
                                <SelectItem key={type} value={type.toLowerCase()}>
                                  {type}
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
                      name="serial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="C02XN1ABMD6R" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model Number</FormLabel>
                          <FormControl>
                            <Input placeholder="MacBook Pro 14-inch" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturer</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select manufacturer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {manufacturers.map((manufacturer) => (
                                <SelectItem key={manufacturer} value={manufacturer.toLowerCase()}>
                                  {manufacturer}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Assignment & Status Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-green-600" />
                    Assignment & Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="available">Available</SelectItem>
                              <SelectItem value="assigned">Assigned</SelectItem>
                              <SelectItem value="maintenance">Under Repair</SelectItem>
                              <SelectItem value="retired">Retired</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="condition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condition</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="used">Used</SelectItem>
                              <SelectItem value="refurbished">Refurbished</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="assignedTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned To</FormLabel>
                          <FormControl>
                            <Input placeholder="Employee name or department" {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Leave empty if available for assignment
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location} value={location.toLowerCase()}>
                                  {location}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
              
            </div>
            
            {/* Right Column */}
            <div className="space-y-6">

              {/* Procurement Details Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4 text-purple-600" />
                    Procurement Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="vendor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor</FormLabel>
                          <FormControl>
                            <Input placeholder="Vendor name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="invoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number</FormLabel>
                          <FormControl>
                            <Input placeholder="INV-2024-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="purchaseDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Date</FormLabel>
                          <FormControl>
                            <DatePicker
                              date={field.value}
                              onDateChange={field.onChange}
                              placeholder="Select purchase date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="warrantyExpiryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Warranty Expiry Date</FormLabel>
                          <FormControl>
                            <DatePicker
                              date={field.value}
                              onDateChange={field.onChange}
                              placeholder="Select warranty expiry"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Finance Details Section (Collapsible) */}
              <Card>
                <Collapsible open={isFinanceOpen} onOpenChange={setIsFinanceOpen}>
                  <CardHeader>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Calculator className="h-4 w-4 text-orange-600" />
                        Finance Details (Optional)
                      </CardTitle>
                      {isFinanceOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="depreciationStartDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Depreciation Start Date</FormLabel>
                              <FormControl>
                                <DatePicker
                                  date={field.value}
                                  onDateChange={field.onChange}
                                  placeholder="Select start date"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="usefulLifeYears"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Useful Life (Years)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="20"
                                  placeholder="3"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Expected useful life for depreciation calculation
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="depreciationMethod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Depreciation Method</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select method" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {depreciationMethods.map((method) => (
                                    <SelectItem key={method} value={method.toLowerCase()}>
                                      {method}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Additional Notes Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-gray-600" />
                    Additional Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description / Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional information about this asset..."
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Any additional details, specifications, or notes about the asset
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              
            </div>
          </div>

          {/* Form Actions - Full Width */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                if (onSuccess) onSuccess();
              }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createAssetMutation.isPending || updateAssetMutation.isPending}
              className="min-w-[120px]"
            >
              {(createAssetMutation.isPending || updateAssetMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditMode ? "Update Asset" : "Create Asset"}
            </Button>
          </div>
        </form>
      </Form>
    </TooltipProvider>
  );
}
