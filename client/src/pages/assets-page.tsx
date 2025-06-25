import { useState } from "react";
import Dashboard from "@/components/layout/Dashboard";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Asset } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import AssetForm from "@/components/forms/AssetForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertCircle,
  Laptop,
  Monitor,
  Smartphone,
  HardDrive
} from "lucide-react";
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
import AssignAssetModal from "@/components/modals/AssignAssetModal";

export default function AssetsPage() {
  const { toast } = useToast();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  
  // Fetch assets
  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });
  
  // Delete asset mutation
  const deleteAssetMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/assets/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Asset deleted",
        description: "The asset has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete asset",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleEditAsset = (id: number) => {
    setSelectedAssetId(id);
    setIsFormDialogOpen(true);
  };
  
  const handleDeleteAsset = (id: number) => {
    setSelectedAssetId(id);
    setIsDeleteDialogOpen(true);
  };
  
  const handleAssignAsset = (id: number) => {
    setSelectedAssetId(id);
    setIsAssignDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (selectedAssetId) {
      deleteAssetMutation.mutate(selectedAssetId);
    }
  };
  
  // Helper function to get the right icon for asset type
  const getAssetIcon = (type: string) => {
    const typeStr = type.toLowerCase();
    if (typeStr.includes('laptop')) return <Laptop className="h-4 w-4" />;
    if (typeStr.includes('monitor')) return <Monitor className="h-4 w-4" />;
    if (typeStr.includes('phone') || typeStr.includes('mobile')) return <Smartphone className="h-4 w-4" />;
    return <HardDrive className="h-4 w-4" />;
  };
  
  // Helper function to get the right color for status badges
  const getStatusColorVariant = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'assigned': return 'secondary';
      case 'maintenance': return 'warning';
      case 'retired': return 'destructive';
      default: return 'default';
    }
  };
  
  return (
    <Dashboard title="Assets" description="Manage your organization's assets.">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Button
            onClick={() => {
              setSelectedAssetId(null);
              setIsFormDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Asset
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : assets.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Type / Category</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Warranty Expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.tag}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="rounded bg-primary-50 p-1 mr-2 text-primary-500">
                            {getAssetIcon(asset.type)}
                          </span>
                          <div>
                            <div>{asset.type}</div>
                            <div className="text-sm text-gray-500">{asset.category}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{asset.serial}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColorVariant(asset.status)}>
                          {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{asset.location || "—"}</TableCell>
                      <TableCell>
                        {asset.warrantyExpiry 
                          ? new Date(asset.warrantyExpiry).toLocaleDateString() 
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditAsset(asset.id)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {asset.status === 'available' && (
                              <DropdownMenuItem onClick={() => handleAssignAsset(asset.id)}>
                                <Laptop className="mr-2 h-4 w-4" />
                                Assign
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteAsset(asset.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-800 mb-1">No assets found</h3>
              <p className="text-sm text-gray-500 mb-4">Get started by creating a new asset.</p>
              <Button
                onClick={() => {
                  setSelectedAssetId(null);
                  setIsFormDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Asset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Asset Form Drawer */}
      <Sheet open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-none p-0 flex flex-col"
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
            <SheetHeader>
              <SheetTitle className="text-xl font-semibold">
                {selectedAssetId ? "Edit Asset" : "Add New Asset"}
              </SheetTitle>
            </SheetHeader>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-24">
            <AssetForm
              assetId={selectedAssetId || undefined}
              onSuccess={() => setIsFormDialogOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the asset and remove all related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteAssetMutation.isPending}
            >
              {deleteAssetMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Assign Asset Modal */}
      <AssignAssetModal
        open={isAssignDialogOpen}
        onClose={() => setIsAssignDialogOpen(false)}
      />
    </Dashboard>
  );
}
