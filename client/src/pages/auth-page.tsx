import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Bot, 
  Brain, 
  Zap, 
  Network, 
  Eye, 
  Shield,
  Sparkles,
  Binary,
  Activity
} from "lucide-react";

// Schemas
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "hr", "it_manager", "employee"]).optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

// Neural Network Animation Component
function NeuralNetwork() {
  const [nodes, setNodes] = useState<Array<{id: number, x: number, y: number, active: boolean}>>([]);
  
  useEffect(() => {
    // Generate random nodes
    const newNodes = Array.from({length: 12}, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      active: false
    }));
    setNodes(newNodes);
    
    // Animate nodes
    const interval = setInterval(() => {
      setNodes(prev => prev.map(node => ({
        ...node,
        active: Math.random() > 0.7
      })));
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="absolute inset-0 overflow-hidden opacity-20">
      <svg className="w-full h-full">
        {/* Connections */}
        {nodes.map((node, i) => 
          nodes.slice(i + 1).map((otherNode, j) => {
            const distance = Math.sqrt(
              Math.pow(node.x - otherNode.x, 2) + Math.pow(node.y - otherNode.y, 2)
            );
            if (distance < 30) {
              return (
                <line
                  key={`${i}-${j}`}
                  x1={`${node.x}%`}
                  y1={`${node.y}%`}
                  x2={`${otherNode.x}%`}
                  y2={`${otherNode.y}%`}
                  stroke="hsl(176, 80%, 49%)"
                  strokeWidth="1"
                  className={`transition-opacity duration-1000 ${
                    node.active || otherNode.active ? 'opacity-60' : 'opacity-20'
                  }`}
                />
              );
            }
            return null;
          })
        )}
        {/* Nodes */}
        {nodes.map(node => (
          <circle
            key={node.id}
            cx={`${node.x}%`}
            cy={`${node.y}%`}
            r="3"
            fill="hsl(176, 80%, 49%)"
            className={`transition-all duration-1000 ${
              node.active ? 'opacity-100 scale-150' : 'opacity-40'
            }`}
          />
        ))}
      </svg>
    </div>
  );
}

// Floating Particles Component
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {Array.from({length: 8}).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-teal-400 rounded-full animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${3 + Math.random() * 2}s`
          }}
        />
      ))}
    </div>
  );
}

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "employee",
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-400 mx-auto mb-4" />
          <p className="text-slate-300">Initializing AI Systems...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  const onLogin = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterFormValues) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 relative overflow-hidden">
      {/* Background Effects */}
      <NeuralNetwork />
      <FloatingParticles />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(20,184,166,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,166,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Hero Section */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-16">
          <div className="max-w-md">
            {/* Logo */}
            <div className="flex items-center mb-8">
              <div className="relative">
                <Bot className="h-12 w-12 text-teal-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-teal-400 rounded-full animate-pulse" />
              </div>
              <div className="ml-3">
                <h1 className="text-3xl font-bold text-white">SyncBridge</h1>
                <p className="text-teal-400 text-sm font-medium">AI-Powered Enterprise Platform</p>
              </div>
            </div>
            
            {/* Hero Content */}
            <h2 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
              Next-Gen
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">
                Intelligent
              </span>
              Asset Management
            </h2>
            
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              Experience the future of enterprise management with AI-driven insights, 
              automated workflows, and intelligent document processing.
            </p>
            
            {/* AI Features */}
            <div className="space-y-4">
              <div className="flex items-center text-slate-300">
                <Brain className="h-5 w-5 text-teal-400 mr-3" />
                <span>AI-Powered Document Summarization</span>
              </div>
              <div className="flex items-center text-slate-300">
                <Zap className="h-5 w-5 text-teal-400 mr-3" />
                <span>Automated Workflow Intelligence</span>
              </div>
              <div className="flex items-center text-slate-300">
                <Network className="h-5 w-5 text-teal-400 mr-3" />
                <span>Smart Asset Lifecycle Tracking</span>
              </div>
              <div className="flex items-center text-slate-300">
                <Eye className="h-5 w-5 text-teal-400 mr-3" />
                <span>Predictive Analytics Dashboard</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Side - Auth Forms */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center mb-8">
              <Bot className="h-10 w-10 text-teal-400 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-white">SyncBridge</h1>
                <p className="text-teal-400 text-sm">AI-Powered Platform</p>
              </div>
            </div>
            
            {/* Auth Card */}
            <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full mb-4">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Welcome Back</h3>
                <p className="text-slate-400">Enter your credentials to access the AI platform</p>
              </div>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-700/50 border border-slate-600">
                  <TabsTrigger 
                    value="login" 
                    className="data-[state=active]:bg-teal-500 data-[state=active]:text-white text-slate-300"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register" 
                    className="data-[state=active]:bg-teal-500 data-[state=active]:text-white text-slate-300"
                  >
                    Create Account
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="space-y-4 mt-6">
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Email Address
                      </label>
                      <Input
                        {...loginForm.register("email")}
                        type="email"
                        placeholder="Enter your email"
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-teal-400"
                      />
                      {loginForm.formState.errors.email && (
                        <p className="text-red-400 text-sm mt-1">
                          {loginForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Password
                      </label>
                      <Input
                        {...loginForm.register("password")}
                        type="password"
                        placeholder="Enter your password"
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-teal-400"
                      />
                      {loginForm.formState.errors.password && (
                        <p className="text-red-400 text-sm mt-1">
                          {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={loginMutation.isPending}
                      className="w-full bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white font-medium py-3 rounded-lg transition-all duration-200"
                    >
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Access AI Platform
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="register" className="space-y-4 mt-6">
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Full Name
                      </label>
                      <Input
                        {...registerForm.register("name")}
                        placeholder="Enter your full name"
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-teal-400"
                      />
                      {registerForm.formState.errors.name && (
                        <p className="text-red-400 text-sm mt-1">
                          {registerForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Email Address
                      </label>
                      <Input
                        {...registerForm.register("email")}
                        type="email"
                        placeholder="Enter your email"
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-teal-400"
                      />
                      {registerForm.formState.errors.email && (
                        <p className="text-red-400 text-sm mt-1">
                          {registerForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Password
                      </label>
                      <Input
                        {...registerForm.register("password")}
                        type="password"
                        placeholder="Create a password"
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-teal-400"
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-red-400 text-sm mt-1">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Role
                      </label>
                      <select
                        {...registerForm.register("role")}
                        className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-md px-3 py-2 focus:border-teal-400 focus:outline-none"
                      >
                        <option value="employee">Employee</option>
                        <option value="hr">HR Manager</option>
                        <option value="it_manager">IT Manager</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={registerMutation.isPending}
                      className="w-full bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white font-medium py-3 rounded-lg transition-all duration-200"
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <Binary className="mr-2 h-4 w-4" />
                          Initialize Account
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              
              {/* AI Status Indicator */}
              <div className="mt-6 flex items-center justify-center text-sm text-slate-400">
                <Activity className="h-4 w-4 text-green-400 mr-2 animate-pulse" />
                AI Systems Online
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}