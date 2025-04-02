import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Building2, Clipboard, BarChart3, Users } from "lucide-react";
import Logo from "@/components/ui/logo";

// Login schema
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Register schema
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  
  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  
  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });
  
  const onLoginSubmit = (data: LoginFormValues) => {
    console.log("Login data:", data);
    loginMutation.mutate(data);
  };
  
  const onRegisterSubmit = (data: RegisterFormValues) => {
    console.log("Register data:", data);
    registerMutation.mutate({ ...data, role: "employee" });
  };
  
  // Handle direct input changes
  const [registerValues, setRegisterValues] = useState({
    name: "",
    email: "",
    password: ""
  });
  
  const [loginValues, setLoginValues] = useState({
    email: "",
    password: ""
  });
  
  // Redirect if user is already logged in
  if (user) {
    return <Redirect to="/" />;
  }
  
  return (
    <div className="min-h-screen flex flex-col justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background to-background/80 dark:from-background dark:to-background/90 z-0"></div>
      
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDYwIDYwIj48ZyBmaWxsPSJjdXJyZW50Q29sb3IiPjxwYXRoIGQ9Ik0zNiAxOGMxLjItLjcgMi41LTEgNC0xIDUuNSAwIDEwIDQuNSAxMCAxMHMtNC41IDEwLTEwIDEwYy0xLjMgMC0yLjUtLjItMy42LS43bC00LjUgNC41Yy0xLS40LTItLjYtMy0uOHYtNi4zbC0zLTN2LTMuN2MtLjYtMS0xLTIuMi0xLTMuNSAwLTMuNSAyLjgtNi40IDYuMy02LjQgMS44IDAgMy40LjggNC41IDIuMWwuMy0xLjF6TTQwIDE0YzYuNiAwIDEyIDUuNCAxMiAxMnMtNS40IDEyLTEyIDEyYy0xLjMgMC0yLjUtLjItMy43LS42bC00LjUgNC41Yy0xLjMuNS0yLjcuOS00LjEgMS4xdi02LjVjLTMuNS0xLjQtNi03LjgtNi0xMC41IDAtOC44IDcuMi0xNiAxNi0xNnptLTkuNSAyMy45bC0uMS0uMS4xLjF6Ii8+PC9nPjwvc3ZnPg==')] z-0"></div>
      
      {/* Floating circles */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-primary/20 blur-3xl"></div>
      <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6 z-10">
        <div className="flex justify-center">
          <Logo size="large" />
        </div>
        <p className="mt-3 text-center text-muted-foreground">
          Asset & Document Management Platform
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-4xl px-4 z-10">
        <div className="bg-card shadow-lg rounded-xl border border-border/30 overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="hidden md:block bg-gradient-to-br from-primary/10 to-primary/5 p-8">
              <div className="h-full flex flex-col justify-center space-y-6">
                <h2 className="text-2xl font-bold mb-2 text-foreground">
                  Enterprise Management Solution
                </h2>
                <p className="text-muted-foreground mb-8">
                  SyncBridge helps companies manage physical assets and employee documents with intelligent tracking, reminders, and reporting in one centralized system.
                </p>
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-foreground">Asset Management</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Track, manage, and assign your company assets efficiently.</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clipboard className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-foreground">Document Lifecycle</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Manage document expiry with intelligent notifications.</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-foreground">Centralized Reporting</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Generate reports for assets, employees, and documents.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-1">Welcome {activeTab === "login" ? "Back" : "to SyncBridge"}</h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "login" 
                    ? "Enter your credentials to access your secure dashboard." 
                    : "Create your account to start managing assets and documents."}
                </p>
              </div>
              
              <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="mt-0">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="login-email">Email</label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="john@example.com"
                        value={loginValues.email}
                        onChange={(e) => setLoginValues({...loginValues, email: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium" htmlFor="login-password">Password</label>
                        <Button variant="ghost" size="sm" className="px-0 h-auto text-xs text-primary">Forgot password?</Button>
                      </div>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••"
                        value={loginValues.password}
                        onChange={(e) => setLoginValues({...loginValues, password: e.target.value})}
                      />
                    </div>
                    
                    <Button 
                      className="w-full"
                      disabled={loginMutation.isPending}
                      onClick={() => {
                        console.log("Manual login with:", loginValues);
                        loginMutation.mutate(loginValues);
                      }}
                    >
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="register" className="mt-0">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="register-name">Full Name</label>
                      <Input
                        id="register-name"
                        placeholder="John Doe"
                        value={registerValues.name}
                        onChange={(e) => setRegisterValues({...registerValues, name: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="register-email">Email</label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="john@example.com"
                        value={registerValues.email}
                        onChange={(e) => setRegisterValues({...registerValues, email: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="register-password">Password</label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••"
                        value={registerValues.password}
                        onChange={(e) => setRegisterValues({...registerValues, password: e.target.value})}
                      />
                    </div>
                    
                    <Button 
                      className="w-full"
                      disabled={registerMutation.isPending}
                      onClick={() => {
                        console.log("Manual register with:", registerValues);
                        registerMutation.mutate({...registerValues, role: "employee"});
                      }}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {activeTab === "login" 
                    ? "Don't have an account yet? " 
                    : "Already have an account? "}
                  <Button 
                    variant="link" 
                    className="p-0 h-auto" 
                    onClick={() => setActiveTab(activeTab === "login" ? "register" : "login")}
                  >
                    {activeTab === "login" ? "Sign up" : "Sign in"}
                  </Button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Version footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground/60 z-10">
        <p>SyncBridge &copy; 2025 - Enterprise Management Solution v1.0</p>
      </div>
    </div>
  );
}
