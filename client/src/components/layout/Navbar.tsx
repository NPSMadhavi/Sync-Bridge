import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Search, Bell, HelpCircle, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { type Notification } from "@shared/schema";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { refreshNotificationQueries } from "@/lib/notification-queries";
import { documentTypeLabel, formatDisplayDate } from "@shared/document-reminder-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function parseNotificationDetails(notification: Notification) {
  const entityType = notification.entityType || "";
  const parts = entityType.split(":");
  const isDocReminder = parts[0] === "doc_reminder";
  const isScheduled = parts[0] === "scheduled";
  const isManualReminder = parts[0] === "manual_reminder";
  const isLicense =
    notification.type === "license_expiry" ||
    entityType === "license" ||
    (isScheduled && parts[1] === "license") ||
    (isManualReminder && parts[1] === "license");

  const reminderType = isDocReminder || isManualReminder ? parts[1] : isScheduled ? parts[1] : "";
  const expiryIso = isDocReminder
    ? parts.slice(5).join(":")
    : isManualReminder
      ? parts[3] || ""
      : isScheduled
        ? parts.slice(4).join(":")
        : "";

  const documentType = isLicense
    ? "License"
    : reminderType
      ? documentTypeLabel(reminderType)
      : "Document";

  const message = notification.message || "";
  let employeeName = "—";
  let dependentName = "—";

  if (isLicense) {
    const licenseMatch = message.match(/License "([^"]+)"/) || message.match(/License ([^"]+) will/);
    employeeName = licenseMatch?.[1] ?? "—";
  } else {
    const forMatch = message.match(/for (.+?) expires|for (.+?) expired/);
    if (forMatch) {
      const segment = forMatch[1] || forMatch[2] || "";
      const dependentMatch = segment.match(/^dependent (.+?) \((.+)\)$/);
      if (dependentMatch) {
        dependentName = dependentMatch[1];
        employeeName = dependentMatch[2];
      } else {
        employeeName = segment;
      }
    } else {
      const docMatch = message.match(/Document "([^"]+)"/);
      if (docMatch) employeeName = docMatch[1];
    }
  }

  return {
    employeeId: notification.entityId ? String(notification.entityId) : "—",
    employeeName,
    dependentName,
    documentType,
    expiryDate: expiryIso ? formatDisplayDate(expiryIso) : "—",
    reminderStatus: notification.seen ? "Read" : "Pending",
    isLicense,
  };
}

export default function Navbar({ toggleMobileSidebar }: { toggleMobileSidebar: () => void }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const expiryNotifications = notifications
    .filter((n) => n.type === "document_expiry" || n.type === "license_expiry")
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
  const unseenCount = expiryNotifications.filter((n) => !n.seen).length;

  const markNotificationAsSeen = async (id: number) => {
    try {
      await apiRequest("PUT", `/api/notifications/${id}/seen`);
      await refreshNotificationQueries();
    } catch (error) {
      console.error("Failed to mark notification as seen", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiRequest("PUT", "/api/notifications/mark-all-seen");
      await refreshNotificationQueries();
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.seen) {
      await markNotificationAsSeen(notification.id);
    }
  };

  return (
    <header className="bg-card border-b border-border flex items-center h-16 px-4 md:px-6">
      <button
        className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mr-4 md:hidden"
        onClick={toggleMobileSidebar}
      >
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex-1 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </span>
          <Input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-background text-foreground"
            placeholder="Search assets, employees, documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-4">
          <DropdownMenu
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (nextOpen) {
                void refreshNotificationQueries();
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800 rounded-full"
              >
                <Bell className="h-5 w-5" />
                {unseenCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium">
                    {unseenCount > 99 ? "99+" : unseenCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0">
              <div className="px-4 py-3 border-b flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {unseenCount > 0
                      ? `${unseenCount} unread reminder${unseenCount === 1 ? "" : "s"}`
                      : "All caught up"}
                  </p>
                </div>
                {unseenCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={markAllAsRead}
                  >
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {expiryNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-4 py-6 text-center">
                    No document or license reminders
                  </p>
                ) : (
                  expiryNotifications.map((notification) => {
                    const details = parseNotificationDetails(notification);
                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors",
                          !notification.seen && "bg-amber-50/80 dark:bg-amber-950/20"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium leading-snug">{notification.message}</p>
                          {!notification.seen && (
                            <span className="shrink-0 h-2 w-2 rounded-full bg-red-500 mt-1.5" />
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
                          {!details.isLicense && (
                            <span>Employee ID: {details.employeeId}</span>
                          )}
                          <span>Status: {details.reminderStatus}</span>
                          <span className={details.isLicense ? "col-span-2" : "col-span-2"}>
                            {details.isLicense ? "License" : "Name"}: {details.employeeName}
                          </span>
                          {!details.isLicense && details.dependentName !== "—" && (
                            <span className="col-span-2">Dependent: {details.dependentName}</span>
                          )}
                          <span>Type: {details.documentType}</span>
                          {details.expiryDate !== "—" && <span>Expiry: {details.expiryDate}</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>

          <div className="relative">
            <Link href="/settings">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200"
              >
                <User className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
