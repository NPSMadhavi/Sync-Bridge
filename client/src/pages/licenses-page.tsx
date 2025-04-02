import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import Dashboard from "@/components/layout/Dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AlertTriangle, CalendarIcon, DownloadIcon, Edit, MoreHorizontal, Plus, Trash2, Key } from "lucide-react";
import { License } from "@shared/schema";
import { format, isAfter, isBefore, addDays } from "date-fns";
import LicenseForm from "@/components/forms/LicenseForm";
import { useToast } from "@/hooks/use-toast";

export default function LicensesPage() {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Fetch licenses
  const { data: licenses = [], isLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });

  // Filtered licenses based on tab
  const filteredLicenses = licenses.filter((license) => {
    if (activeTab === "all") return true;
    if (activeTab === "expiringSoon") {
      return (
        license.expiryDate &&
        isAfter(new Date(license.expiryDate), new Date()) &&
        isBefore(new Date(license.expiryDate), addDays(new Date(), 30))
      );
    }
    if (activeTab === "expired") {
      return (
        license.expiryDate && isBefore(new Date(license.expiryDate), new Date())
      );
    }
    return true;
  });

  // Delete license mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/licenses/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "License deleted",
        description: "The license has been deleted successfully.",
      });
      setIsDeleteAlertOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete the license. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle license deletion
  const handleDelete = () => {
    if (selectedLicense) {
      deleteMutation.mutate(selectedLicense.id);
    }
  };

  // Generate CSV report
  const handleGenerateReport = () => {
    window.open("/api/reports/expiring-licenses", "_blank");
  };

  // Calculate license status badge
  const getLicenseStatusBadge = (license: License) => {
    if (!license.expiryDate) return null;
    
    const expiryDate = new Date(license.expiryDate);
    const now = new Date();
    
    if (isBefore(expiryDate, now)) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (isBefore(expiryDate, addDays(now, 30))) {
      return <Badge variant="warning">Expiring Soon</Badge>;
    } else {
      return <Badge variant="outline">Valid</Badge>;
    }
  };

  return (
    <Dashboard>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Licenses</h2>
          <p className="text-muted-foreground">
            Manage software and hardware licenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateReport}
            className="flex items-center gap-2"
          >
            <DownloadIcon className="h-4 w-4" /> Export Report
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add License
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="all"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="all">All Licenses</TabsTrigger>
          <TabsTrigger value="expiringSoon">Expiring Soon</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="p-0">
            {filteredLicenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Key className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">No licenses found</h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  {isLoading
                    ? "Loading licenses..."
                    : "You haven't added any licenses yet. Add a license to track software and hardware assets."}
                </p>
                {!isLoading && (
                  <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Your First License
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLicenses.map((license) => (
                    <TableRow key={license.id}>
                      <TableCell className="font-medium">{license.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {license.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {license.licenseKey.length > 12
                          ? `${license.licenseKey.substring(0, 12)}...`
                          : license.licenseKey}
                      </TableCell>
                      <TableCell>
                        {license.purchaseDate
                          ? format(new Date(license.purchaseDate), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {license.expiryDate
                          ? format(new Date(license.expiryDate), "MMM d, yyyy")
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        {getLicenseStatusBadge(license)}
                      </TableCell>
                      <TableCell>
                        {license.assetId ? `#${license.assetId}` : "-"}
                      </TableCell>
                      <TableCell>{license.seats || "-"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedLicense(license);
                                setIsEditModalOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedLicense(license);
                                setIsDeleteAlertOpen(true);
                              }}
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
            )}
          </CardContent>
        </Card>
      </Tabs>

      {/* Create License Modal */}
      {isCreateModalOpen && (
        <LicenseForm
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {/* Edit License Modal */}
      {isEditModalOpen && selectedLicense && (
        <LicenseForm
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          license={selectedLicense}
        />
      )}

      {/* Delete License Alert */}
      <AlertDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              license and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dashboard>
  );
}