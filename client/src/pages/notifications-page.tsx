import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NumberInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BellIcon, MailIcon, CheckCircleIcon, AlertTriangleIcon } from "lucide-react";
import Dashboard from "@/components/layout/Dashboard";

export default function NotificationsPage() {
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [isCheckingExpiring, setIsCheckingExpiring] = useState(false);
  const [documentId, setDocumentId] = useState("");
  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const { toast } = useToast();

  const testExpiryNotification = async () => {
    if (!documentId) {
      toast({
        title: "Error",
        description: "Please enter a document ID",
        variant: "destructive",
      });
      return;
    }

    setIsTestingNotification(true);
    try {
      const response = await apiRequest("POST", "/api/notifications/test-expiry", {
        documentId: parseInt(documentId)
      });
      const result = await response.json();
      
      toast({
        title: "Success",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  const checkExpiringDocuments = async () => {
    setIsCheckingExpiring(true);
    try {
      const response = await apiRequest("POST", "/api/notifications/check-expiring");
      const result = await response.json();
      
      toast({
        title: "Success",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check expiring documents",
        variant: "destructive",
      });
    } finally {
      setIsCheckingExpiring(false);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const response = await apiRequest("GET", "/api/notifications/settings");
      const settings = await response.json();
      setNotificationSettings(settings);
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    }
  };

  return (
 <Dashboard
    title={<span className="text-[32px] font-bold">Documnet Notifications</span>}
    description="Manage your organization's assets."
  >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
        {/* Email Settings Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailIcon className="h-5 w-5" />
              Email Configuration
            </CardTitle>
            <CardDescription>
              Check if email notifications are properly configured
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>SMTP Status</span>
              <Badge variant="default">
                Configured
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Monitoring</span>
              <Badge variant="default">
                <CheckCircleIcon className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            <Button 
              onClick={loadNotificationSettings}
              variant="outline"
              className="w-full"
            >
              Check Settings
            </Button>
            {notificationSettings && (
              <div className="text-sm text-muted-foreground">
                <p>Alert Days: {notificationSettings.alertDays?.join(", ")}</p>
                <p>Last Check: {new Date(notificationSettings.lastCheck).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellIcon className="h-5 w-5" />
              Test Notifications
            </CardTitle>
            <CardDescription>
              Send test notifications to verify email functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document-id">Document ID (for testing)</Label>
              <NumberInput
                id="document-id"
                placeholder="Enter document ID"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
              />
            </div>
            <Button 
              onClick={testExpiryNotification}
              disabled={isTestingNotification}
              className="w-full"
            >
              {isTestingNotification ? "Sending..." : "Send Test Notification"}
            </Button>
          </CardContent>
        </Card>

        {/* Document Expiry Check */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5" />
              Document Expiry Monitoring
            </CardTitle>
            <CardDescription>
              Manually trigger checks for expiring documents across the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="space-y-2">
                <div className="text-2xl font-bold">30</div>
                <div className="text-sm text-muted-foreground">Days Before Alert</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold">14</div>
                <div className="text-sm text-muted-foreground">Days Warning</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold">7</div>
                <div className="text-sm text-muted-foreground">Days Critical</div>
              </div>
            </div>
            <Button 
              onClick={checkExpiringDocuments}
              disabled={isCheckingExpiring}
              className="w-full"
              size="lg"
            >
              {isCheckingExpiring ? "Checking..." : "Check All Expiring Documents"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              This will scan all company and employee documents for upcoming expiry dates
              and send email notifications to relevant parties.
            </p>
          </CardContent>
        </Card>
      </div>
      </div>
    </Dashboard>
  );
}