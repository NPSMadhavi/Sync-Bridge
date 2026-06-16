import Dashboard from "@/components/layout/Dashboard";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function NoAccessPage() {
  return (
    <Dashboard title="Access Restricted">
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No module access assigned</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your account does not have access to any modules. Contact your administrator to assign
            module permissions.
          </p>
        </CardContent>
      </Card>
    </Dashboard>
  );
}
