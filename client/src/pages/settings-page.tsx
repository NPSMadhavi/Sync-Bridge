import React, { useState } from "react";
import Dashboard from "@/components/layout/Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input, NumberInput } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Receipt, UserCheck, Mail, Send } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Profile form schema
const profileFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

// Password form schema
const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
  newPassword: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
  confirmPassword: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Email settings form schema
const emailSettingsFormSchema = z.object({
  smtpHost: z.string().min(1, {
    message: "SMTP Host is required.",
  }),
  smtpPort: z.string().min(1, {
    message: "SMTP Port is required.",
  }),
  smtpSecure: z.string().min(1, {
    message: "Encryption method is required.",
  }),
  smtpUser: z.string().min(1, {
    message: "SMTP Username is required.",
  }),
  smtpPass: z.string().min(1, {
    message: "SMTP Password is required.",
  }),
  emailFrom: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;
type EmailSettingsFormValues = z.infer<typeof emailSettingsFormSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  
  // DEBUG: Print user object to console
  React.useEffect(() => {
    console.log('[DEBUG] Current user in SettingsPage:', user);
  }, [user]);

  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    mode: "onChange",
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  // Update form values when user data is available
  React.useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user, profileForm]);


  
  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Email settings form
  const emailSettingsForm = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(emailSettingsFormSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: "587",
      smtpSecure: "STARTTLS",
      smtpUser: "",
      smtpPass: "",
      emailFrom: "",
    },
  });

  // Fetch email settings
  const { data: emailSettings, isLoading: emailSettingsLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email-settings');
      return await response.json();
    },
    enabled: !!user
  });

  // Update email settings form when data is loaded
  React.useEffect(() => {
    if (emailSettings) {
      emailSettingsForm.reset({
        smtpHost: emailSettings.smtpHost || "",
        smtpPort: emailSettings.smtpPort?.toString() || "587",
        smtpSecure: emailSettings.smtpSecure || "STARTTLS",
        smtpUser: emailSettings.smtpUser || "",
        smtpPass: "", // Don't pre-fill password for security
        emailFrom: emailSettings.emailFrom || "",
      });
    }
  }, [emailSettings, emailSettingsForm]);
  
  // Update profile
  const onProfileSubmit = async (data: ProfileFormValues) => {
    setIsUpdatingProfile(true);
    try {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      toast({
        title: "Profile updated",
        description: "Your profile information has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  
  // Change password
  const onPasswordSubmit = (data: PasswordFormValues) => {
    toast({
      title: "Password changed",
      description: "Your password has been changed successfully.",
    });
    passwordForm.reset();
  };
  
  // Save notification settings
  const onSaveNotificationSettings = async () => {
    setIsSavingNotifications(true);
    try {
      // Get form values from the notification settings
      const documentExpiry = (document.getElementById('document-expiry') as HTMLInputElement)?.checked;
      const assetAssignment = (document.getElementById('asset-assignment') as HTMLInputElement)?.checked;
      const maintenanceAlerts = (document.getElementById('maintenance-alerts') as HTMLInputElement)?.checked;
      const expiryDays = (document.getElementById('expiry-days') as HTMLInputElement)?.value;
      const reminderFrequency = (document.getElementById('reminder-frequency') as HTMLInputElement)?.value;
      
      const settings = {
        documentExpiry,
        assetAssignment,
        maintenanceAlerts,
        expiryDays: parseInt(expiryDays) || 30,
        reminderFrequency: parseInt(reminderFrequency) || 7,
      };
      
      const response = await apiRequest('POST', '/api/notifications/settings', settings);
      
      if (response.ok) {
        toast({
          title: "Settings saved",
          description: "Your notification settings have been saved successfully.",
        });
      } else {
        throw new Error('Failed to save notification settings');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save notification settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // Save system settings
  const onSaveSystemSettings = async () => {
    setIsSavingSystem(true);
    try {
      // Get form values from the system settings
      const dateFormat = (document.getElementById('date-format') as HTMLSelectElement)?.value;
      const darkMode = (document.getElementById('dark-mode') as HTMLInputElement)?.checked;
      const exportFormat = (document.getElementById('export-format') as HTMLSelectElement)?.value;
      
      const settings = {
        dateFormat: dateFormat || "MM/DD/YYYY",
        darkMode: darkMode || false,
        exportFormat: exportFormat || "csv",
        timezone: "UTC",
        language: "en",
      };
      
      const response = await apiRequest('POST', '/api/system/settings', settings);
      
      if (response.ok) {
        toast({
          title: "Settings saved",
          description: "Your system settings have been saved successfully.",
        });
      } else {
        throw new Error('Failed to save system settings');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save system settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSystem(false);
    }
  };

  // Save email settings
  const onEmailSettingsSubmit = async (data: EmailSettingsFormValues) => {
    setIsSavingEmailSettings(true);
    try {
      const response = await apiRequest('POST', '/api/email-settings', data);
      
      if (response.ok) {
        toast({
          title: "Email settings saved",
          description: "Your email configuration has been saved successfully.",
        });
        queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      } else {
        throw new Error('Failed to save email settings');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save email settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEmailSettings(false);
    }
  };

  // Test email configuration
  const onTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Please enter a test email address.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingEmail(true);
    try {
      const response = await apiRequest('POST', '/api/email-settings/test', {
        testEmail
      });
      
      if (response.ok) {
        toast({
          title: "Test email sent",
          description: `Test email sent successfully to ${testEmail}. Please check your inbox.`,
        });
      } else {
        throw new Error('Failed to send test email');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test email. Please check your email configuration.",
        variant: "destructive",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };
  
  return (
     <Dashboard
        title={<span className="text-[32px] font-bold">Settings</span>}
        description="Manage your organization's assets."
      >
      <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/4">
            <TabsList className="flex flex-col h-auto bg-transparent space-y-1 p-0">
              <TabsTrigger
                value="profile"
                className="justify-start px-4 py-2 rounded-md data-[state=active]:bg-primary-50 data-[state=active]:text-primary-700"
              >
                Profile
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="justify-start px-4 py-2 rounded-md data-[state=active]:bg-primary-50 data-[state=active]:text-primary-700"
              >
                Security
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="justify-start px-4 py-2 rounded-md data-[state=active]:bg-primary-50 data-[state=active]:text-primary-700"
              >
                Notifications
              </TabsTrigger>
              <TabsTrigger
                value="email-config"
                className="justify-start px-4 py-2 rounded-md data-[state=active]:bg-primary-50 data-[state=active]:text-primary-700"
              >
                Email Configuration
              </TabsTrigger>
              <TabsTrigger
                value="system"
                className="justify-start px-4 py-2 rounded-md data-[state=active]:bg-primary-50 data-[state=active]:text-primary-700"
              >
                System
              </TabsTrigger>
              {user?.role === 'vendor' && (
                <TabsTrigger
                  value="vendor"
                  className="justify-start px-4 py-2 rounded-md data-[state=active]:bg-primary-50 data-[state=active]:text-primary-700"
                >
                  Vendor Settings
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          <div className="md:w-3/4">
            <TabsContent value="profile" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>
                    Update your personal information.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                      <FormField
                        control={profileForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormDescription>
                              This is the email used for login and notifications.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="mt-6">
                        <Button 
                          type="submit" 
                          disabled={isUpdatingProfile}
                        >
                          {isUpdatingProfile ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                        {profileForm.formState.errors.name && (
                          <p className="text-sm text-red-500 mt-2">
                            {profileForm.formState.errors.name.message}
                          </p>
                        )}
                        {profileForm.formState.errors.email && (
                          <p className="text-sm text-red-500 mt-2">
                            {profileForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="security" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>
                    Manage your password and security settings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••" {...field} />
                            </FormControl>
                            <FormDescription>
                              Password must be at least 6 characters.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="mt-6">
                        <Button type="submit">
                          {passwordForm.formState.isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Changing Password...
                            </>
                          ) : (
                            "Change Password"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="notifications" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    Configure how you receive notifications.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="document-expiry" className="font-medium">Document Expiry</Label>
                          <p className="text-sm text-gray-500">
                            Receive alerts when documents are close to expiration
                          </p>
                        </div>
                        <Switch id="document-expiry" defaultChecked />
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="asset-assignment" className="font-medium">Asset Assignments</Label>
                          <p className="text-sm text-gray-500">
                            Notifications when assets are assigned or returned
                          </p>
                        </div>
                        <Switch id="asset-assignment" defaultChecked />
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="maintenance-alerts" className="font-medium">Maintenance Alerts</Label>
                          <p className="text-sm text-gray-500">
                            Receive alerts for maintenance schedules and issues
                          </p>
                        </div>
                        <Switch id="maintenance-alerts" defaultChecked />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">Notification Timing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiry-days" className="font-medium">Document Expiry Alert Days</Label>
                        <NumberInput 
                          id="expiry-days"
                          placeholder="30"
                          defaultValue="30"
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Days before expiry to send first alert
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="reminder-frequency" className="font-medium">Reminder Frequency</Label>
                        <NumberInput 
                          id="reminder-frequency"
                          placeholder="7"
                          defaultValue="7"
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Days between reminder notifications
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button 
                      onClick={onSaveNotificationSettings}
                      disabled={isSavingNotifications}
                    >
                      {isSavingNotifications ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Notification Settings"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="email-config" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Email Configuration</CardTitle>
                  <CardDescription>
                    Configure SMTP settings for email notifications and communications.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {emailSettingsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Loading email settings...
                    </div>
                  ) : (
                    <Form {...emailSettingsForm}>
                      <form onSubmit={emailSettingsForm.handleSubmit(onEmailSettingsSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={emailSettingsForm.control}
                            name="smtpHost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Host</FormLabel>
                                <FormControl>
                                  <Input placeholder="mail.example.com" {...field} />
                                </FormControl>
                                <FormDescription>
                                  The SMTP server hostname
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={emailSettingsForm.control}
                            name="smtpPort"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Port</FormLabel>
                                <FormControl>
                                  <Input placeholder="587" {...field} />
                                </FormControl>
                                <FormDescription>
                                  The SMTP server port (usually 587 or 465)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={emailSettingsForm.control}
                          name="smtpSecure"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Encryption</FormLabel>
                              <FormControl>
                                <select
                                  {...field}
                                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                                >
                                  <option value="None">None</option>
                                  <option value="SSL/TLS">SSL/TLS</option>
                                  <option value="STARTTLS">STARTTLS</option>
                                </select>
                              </FormControl>
                              <FormDescription>
                                Choose the encryption method for your SMTP connection
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={emailSettingsForm.control}
                            name="smtpUser"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Username</FormLabel>
                                <FormControl>
                                  <Input placeholder="user@example.com" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Your SMTP authentication username
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={emailSettingsForm.control}
                            name="smtpPass"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="••••••••" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Your SMTP authentication password
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={emailSettingsForm.control}
                          name="emailFrom"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>From Email Address</FormLabel>
                              <FormControl>
                                <Input placeholder="noreply@example.com" {...field} />
                              </FormControl>
                              <FormDescription>
                                The email address that will appear as the sender
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Separator />

                        <div>
                          <h3 className="text-lg font-medium mb-4">Test Configuration</h3>
                          <div className="flex gap-4 items-end">
                            <div className="flex-1">
                              <Label htmlFor="test-email" className="font-medium">Test Email Address</Label>
                              <Input
                                id="test-email"
                                type="email"
                                placeholder="test@example.com"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="mt-1"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Enter an email address to test your configuration
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={onTestEmail}
                              disabled={isTestingEmail || !testEmail}
                            >
                              {isTestingEmail ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Send className="mr-2 h-4 w-4" />
                                  Send Test Email
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <Button 
                            type="submit" 
                            disabled={isSavingEmailSettings}
                          >
                            {isSavingEmailSettings ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Mail className="mr-2 h-4 w-4" />
                                Save Email Settings
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="system" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>
                    Configure system-wide settings and preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Date & Time</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="date-format" className="font-medium">Date Format</Label>
                        <select
                          id="date-format"
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                          defaultValue="MM/DD/YYYY"
                        >
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="dark-mode" className="font-medium">Dark Mode</Label>
                          <p className="text-sm text-gray-500">
                            Use dark theme for the application
                          </p>
                        </div>
                        <Switch id="dark-mode" />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">Data Export</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="export-format" className="font-medium">Default Export Format</Label>
                        <select
                          id="export-format"
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                          defaultValue="csv"
                        >
                          <option value="csv">CSV</option>
                          <option value="excel">Excel</option>
                          <option value="pdf">PDF</option>
                        </select>
                      </div>
                      
                      <div className="pt-4">
                        <Button variant="outline">Export All Data</Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button 
                      onClick={onSaveSystemSettings}
                      disabled={isSavingSystem}
                    >
                      {isSavingSystem ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save System Settings"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {user?.role === 'vendor' && (
              <TabsContent value="vendor" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Vendor Settings</CardTitle>
                    <CardDescription>
                      Manage your products, prices, and customers.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Button 
                            variant="outline" 
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => window.location.href = '/vendor-settings'}
                          >
                            <Plus className="h-6 w-6 mb-2" />
                            Add Product
                          </Button>
                          <Button 
                            variant="outline" 
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => window.location.href = '/vendor-settings?tab=prices'}
                          >
                            <Receipt className="h-6 w-6 mb-2" />
                            Set Prices
                          </Button>
                          <Button 
                            variant="outline" 
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => window.location.href = '/vendor-settings?tab=customers'}
                          >
                            <UserCheck className="h-6 w-6 mb-2" />
                            Add Customers
                          </Button>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h3 className="text-lg font-medium mb-4">Vendor Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="font-medium">Vendor Email</Label>
                            <p className="text-sm text-gray-600 mt-1">{user?.email}</p>
                          </div>
                          <div>
                            <Label className="font-medium">Role</Label>
                            <p className="text-sm text-gray-600 mt-1 capitalize">{user?.role}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <Button onClick={() => window.location.href = '/vendor-settings'}>
                          Go to Vendor Settings
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </div>
        </div>
      </Tabs>
    </Dashboard>
  );
}
