import { useState } from "react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { assetStatusEnum } from "@shared/schema";
import { Loader2 } from "lucide-react";

type AssetFormData = z.infer<typeof formSchema>;

// Extend the schema to add validation
const formSchema = insertAssetSchema.extend({
  tag: z.string().min(3, "Tag must be at least 3 characters"),
  type: z.string().min(2, "Type must be at least 2 characters"),
  category: z.string().min(2, "Category must be at least 2 characters"),
  serial: z.string().min(2, "Serial number must be at least 2 characters"),
});

interface AssetFormProps {
  assetId?: number;
  onSuccess?: () => void;
}

export default function AssetForm({ assetId, onSuccess }: AssetFormProps) {
  const { toast } = useToast();
  const [isEditMode] = useState(!!assetId);
  
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
      status: "available",
      location: "",
      vendorId: undefined,
      purchaseDate: undefined,
      warrantyExpiry: undefined,
    },
  });
  
  // Update form when asset data is loaded
  useState(() => {
    if (assetData) {
      form.reset({
        ...assetData,
        purchaseDate: assetData.purchaseDate ? new Date(assetData.purchaseDate) : undefined,
        warrantyExpiry: assetData.warrantyExpiry ? new Date(assetData.warrantyExpiry) : undefined,
      });
    }
  });
  
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="tag"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asset Tag</FormLabel>
                <FormControl>
                  <Input placeholder="IT-1024" {...field} />
                </FormControl>
                <FormDescription>
                  Unique identifier for the asset
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asset Type</FormLabel>
                <FormControl>
                  <Input placeholder="Laptop" {...field} />
                </FormControl>
                <FormDescription>
                  Type of the asset (e.g., Laptop, Monitor)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input placeholder="Computing" {...field} />
                </FormControl>
                <FormDescription>
                  Category of the asset
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="serial"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Serial Number</FormLabel>
                <FormControl>
                  <Input placeholder="FVFXT85ZGGH7" {...field} />
                </FormControl>
                <FormDescription>
                  Serial number of the asset
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(assetStatusEnum.enumValues).map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Current status of the asset
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
                <FormControl>
                  <Input placeholder="HQ Office, Floor 2" {...field} />
                </FormControl>
                <FormDescription>
                  Current location of the asset
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="vendorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id.toString()}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Vendor who supplied the asset
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="purchaseDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Purchase Date</FormLabel>
                <DatePicker
                  date={field.value}
                  setDate={(date) => field.onChange(date)}
                />
                <FormDescription>
                  Date when the asset was purchased
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="warrantyExpiry"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Warranty Expiry</FormLabel>
                <DatePicker
                  date={field.value}
                  setDate={(date) => field.onChange(date)}
                />
                <FormDescription>
                  Date when the warranty expires
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSuccess && onSuccess()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createAssetMutation.isPending || updateAssetMutation.isPending}
          >
            {createAssetMutation.isPending || updateAssetMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>{isEditMode ? "Update Asset" : "Create Asset"}</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
