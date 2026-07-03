import React, { useState } from "react";
import Dashboard from "@/components/layout/Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { Loader2, Mail, Send, Hash } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRunningNumber } from "@shared/schema";
import { canManageRunningNumber } from "@/lib/running-number-access";
import { RunningNumberSettingsCard } from "@/components/settings/RunningNumberSettingsCard";

// Profile form schema
const profileFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  sendReminderEmails: z.boolean(),
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
  smtpPass: z.string().optional(),
  emailFrom: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;
type EmailSettingsFormValues = z.infer<typeof emailSettingsFormSchema>;

const runningNumberFormSchema = z.object({
  prefix: z.string().trim().min(1, { message: "Prefix is required" }),
  nextCounter: z
    .string()
    .trim()
    .min(1, { message: "Next Counter is required" })
    .refine((val) => !Number.isNaN(Number(val)), {
      message: "Next Counter must be numeric",
    })
    .refine((val) => Number.isInteger(Number(val)), {
      message: "Next Counter must be numeric",
    })
    .refine((val) => Number(val) >= 0, {
      message: "Counter cannot be negative",
    }),
  suffix: z.string().optional(),
});

type RunningNumberFormValues = z.infer<typeof runningNumberFormSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, tenantId: authTenantId } = useAuth();
  const queryClient = useQueryClient();
  const manageRunningNumber = canManageRunningNumber(user);
  const effectiveTenantId =
    authTenantId ??
    (user?.role === "super_admin" || user?.isSuperAdmin ? 1 : null);
  const [activeTab, setActiveTab] = useState("profile");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false);
  const [isSavingRunningNumber, setIsSavingRunningNumber] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
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
      sendReminderEmails: user?.sendReminderEmails ?? false,
    },
  });

  // Update form values when user data is available
  React.useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name || "",
        email: user.email || "",
        sendReminderEmails: user.sendReminderEmails ?? false,
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

  const runningNumberForm = useForm<RunningNumberFormValues>({
    resolver: zodResolver(runningNumberFormSchema),
    defaultValues: {
      prefix: "",
      nextCounter: "",
      suffix: "",
    },
  });

  const { data: runningNumberSettings, isLoading: runningNumberLoading } = useQuery({
    queryKey: ["running-number", "employee"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/running-numbers/employee");
      return await response.json();
    },
    enabled: !!user && manageRunningNumber && effectiveTenantId != null,
  });

  React.useEffect(() => {
    if (runningNumberSettings?.configured) {
      runningNumberForm.reset({
        prefix: runningNumberSettings.prefix || "",
        nextCounter:
          runningNumberSettings.nextCounter != null
            ? String(runningNumberSettings.nextCounter)
            : "",
        suffix: runningNumberSettings.suffix || "",
      });
    }
  }, [runningNumberSettings, runningNumberForm]);

  const watchedPrefix = runningNumberForm.watch("prefix");
  const watchedCounter = runningNumberForm.watch("nextCounter");
  const watchedSuffix = runningNumberForm.watch("suffix");
  const runningNumberPreview =
    watchedCounter?.trim() === ""
      ? "—"
      : formatRunningNumber(
          watchedPrefix ?? "",
          Number(watchedCounter),
          watchedSuffix
        );
  
  // Update profile
  const onProfileSubmit = async (data: ProfileFormValues) => {
    setIsUpdatingProfile(true);
    try {
      const response = await apiRequest("PUT", "/api/profile", data);
      const updatedUser = await response.json();
      queryClient.setQueryData(["/api/user"], updatedUser);

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
  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsChangingPassword(true);
    try {
      const response = await apiRequest("POST", "/api/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      if (response.ok) {
        toast({
          title: "Password changed",
          description: "Your password has been changed successfully.",
        });
        passwordForm.reset();
      } else {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || "Failed to change password");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const onSaveSystemSettings = async () => {
    setIsSavingSystem(true);
    try {
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
    if (!data.smtpPass?.trim() && !emailSettings?.hasPassword) {
      emailSettingsForm.setError("smtpPass", {
        message: "SMTP Password is required.",
      });
      return;
    }

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

  const onRunningNumberSubmit = async (data: RunningNumberFormValues) => {
    if (!effectiveTenantId) {
      toast({
        title: "Error",
        description: "Tenant context is required to save running number settings.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingRunningNumber(true);
    try {
      const response = await apiRequest("PUT", "/api/running-numbers/employee", {
        prefix: data.prefix,
        nextCounter: Number(data.nextCounter),
        suffix: data.suffix ?? "",
        tenantId: effectiveTenantId,
      });

      if (response.ok) {
        runningNumberForm.reset({
          prefix: data.prefix,
          nextCounter: data.nextCounter,
          suffix: data.suffix ?? "",
        });
        toast({
          title: "Running number saved",
          description: "Employee ID running number configuration has been saved.",
        });
        queryClient.invalidateQueries({ queryKey: ["running-number", "employee"] });
      } else {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || "Failed to save running number");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save running number. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingRunningNumber(false);
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

    const formValues = emailSettingsForm.getValues();
    const smtpHost = formValues.smtpHost?.trim();
    const smtpUser = formValues.smtpUser?.trim();
    const emailFrom = formValues.emailFrom?.trim();

    if (
      smtpHost?.toLowerCase().includes("gmail") &&
      smtpUser &&
      emailFrom &&
      smtpUser.toLowerCase() !== emailFrom.toLowerCase()
    ) {
      toast({
        title: "Gmail configuration error",
        description:
          "SMTP Username and From Email Address must be the same Gmail account.",
        variant: "destructive",
      });
      return;
    }

    if (!formValues.smtpPass?.trim() && !emailSettings?.hasPassword) {
      toast({
        title: "SMTP password required",
        description: "Enter your SMTP password (use a Google App Password for Gmail) before testing.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingEmail(true);
    try {
      const response = await apiRequest('POST', '/api/email-settings/test', {
        testEmail,
        smtpHost: formValues.smtpHost,
        smtpPort: formValues.smtpPort,
        smtpSecure: formValues.smtpSecure,
        smtpUser: formValues.smtpUser,
        smtpPass: formValues.smtpPass?.trim() || undefined,
        emailFrom: formValues.emailFrom,
      });
      
      if (response.ok) {
        toast({
          title: "Test email sent",
          description: `Test email sent successfully to ${testEmail}. Please check your inbox.`,
        });
      } else {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || "Failed to send test email");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email. Please check your email configuration.",
        variant: "destructive",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };
  
  const settingsNavClass = () =>
    cn(
      "inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
      "h-auto whitespace-nowrap shadow-none",
      "border border-gray-200 bg-white text-gray-900",
      "hover:bg-gray-50 hover:border-gray-300",
      "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary",
      "data-[state=active]:hover:bg-primary/90 data-[state=active]:shadow-none"
    );

  return (
     <Dashboard
        title={<span className="text-[32px] font-bold">Settings</span>}
        description="Manage company preferences and account settings."
      >
      <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-row flex-wrap h-auto w-full bg-transparent p-0 gap-2 justify-center items-center">
          <TabsTrigger value="profile" className={settingsNavClass()}>
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className={settingsNavClass()}>
            Security
          </TabsTrigger>
          <TabsTrigger value="email-config" className={settingsNavClass()}>
            Email Configuration
          </TabsTrigger>
          <TabsTrigger value="running-number" className={settingsNavClass()}>
            Running Number System
          </TabsTrigger>
          <TabsTrigger value="system" className={settingsNavClass()}>
            System
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 w-full max-w-4xl mx-auto">
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

                      <FormField
                        control={profileForm.control}
                        name="sendReminderEmails"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => field.onChange(checked === true)}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Send reminder notifications to this email</FormLabel>
                              <FormDescription>
                                When enabled, license and company document expiry reminders will be
                                sent to this profile email. NRIC, passport, and visa reminders are
                                always sent to each employee&apos;s registered email address.
                              </FormDescription>
                            </div>
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
                        <Button type="submit" disabled={isChangingPassword}>
                          {isChangingPassword ? (
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
                                  {emailSettings?.hasPassword
                                    ? "Leave blank to keep the saved password. For Gmail, use a Google App Password."
                                    : "Your SMTP password. For Gmail, use a Google App Password (not your normal password)."}
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
                                The sender address. For Gmail, this must match SMTP Username.
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

            <TabsContent value="running-number" className="mt-0">
              {manageRunningNumber ? (
                <div className="rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 px-6 py-5">
                    <div className="flex items-center gap-2">
                   
                      <h2 className="text-lg font-semibold text-gray-900">Running Numbers</h2>
                    </div>
                    
                  </div>
                  <div className="p-6 pt-4">
                    <RunningNumberSettingsCard
                      moduleName="Employee"
                      preview={runningNumberPreview}
                      form={runningNumberForm}
                      onSubmit={onRunningNumberSubmit}
                      isLoading={runningNumberLoading}
                      isSaving={isSavingRunningNumber}
                      showSaveButton
                      embedded
                    />
                  </div>
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Running Number System</CardTitle>
                    <CardDescription>
                      You do not have permission to manage running number settings.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
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
                        <Switch id="dark-mode" disabled checked={false} />
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
                    <Button onClick={onSaveSystemSettings} disabled={isSavingSystem}>
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
        </div>
      </Tabs>
    </Dashboard>
  );
}
