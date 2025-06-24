import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, Brain, Activity, Sparkles, Zap, Network, Bot, Binary } from "lucide-react";
import { Redirect } from "wouter";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Neural Network Animation Component
function NeuralNetwork() {
  const [nodes, setNodes] = useState<Array<{id: number, x: number, y: number, active: boolean}>>([]);
  const [connections, setConnections] = useState<Array<{from: number, to: number, active: boolean}>>([]);

  useEffect(() => {
    // Generate random nodes
    const newNodes = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      active: false
    }));
    setNodes(newNodes);

    // Generate connections
    const newConnections: Array<{from: number, to: number, active: boolean}> = [];
    for (let i = 0; i < newNodes.length; i++) {
      for (let j = i + 1; j < newNodes.length; j++) {
        if (Math.random() < 0.1) { // 10% chance of connection
          newConnections.push({ from: i, to: j, active: false });
        }
      }
    }
    setConnections(newConnections);

    // Animate nodes and connections
    const interval = setInterval(() => {
      setNodes(prev => prev.map(node => ({
        ...node,
        active: Math.random() < 0.3
      })));
      setConnections(prev => prev.map(conn => ({
        ...conn,
        active: Math.random() < 0.2
      })));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden opacity-20">
      <svg className="w-full h-full">
        {connections.map((conn, index) => {
          const fromNode = nodes[conn.from];
          const toNode = nodes[conn.to];
          if (!fromNode || !toNode) return null;
          
          return (
            <line
              key={index}
              x1={`${fromNode.x}%`}
              y1={`${fromNode.y}%`}
              x2={`${toNode.x}%`}
              y2={`${toNode.y}%`}
              stroke={conn.active ? "#14b8a6" : "#475569"}
              strokeWidth="1"
              className="transition-all duration-500"
            />
          );
        })}
        {nodes.map(node => (
          <circle
            key={node.id}
            cx={`${node.x}%`}
            cy={`${node.y}%`}
            r="3"
            fill={node.active ? "#14b8a6" : "#64748b"}
            className="transition-all duration-500"
          />
        ))}
      </svg>
    </div>
  );
}

// Floating Particles Component
function FloatingParticles() {
  const [particles, setParticles] = useState<Array<{id: number, x: number, y: number, vx: number, vy: number}>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.1
    }));
    setParticles(newParticles);

    const interval = setInterval(() => {
      setParticles(prev => prev.map(particle => ({
        ...particle,
        x: (particle.x + particle.vx + 100) % 100,
        y: (particle.y + particle.vy + 100) % 100
      })));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden opacity-30">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute w-1 h-1 bg-teal-400 rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      ))}
    </div>
  );
}

export default function AuthPage() {
  const { user, loginMutation, isLoading } = useAuth();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
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
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg text-center">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-400 to-blue-500 rounded-2xl mb-6">
                <Brain className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
                SyncBridge
              </h1>
              <p className="text-xl text-slate-300 mb-8">
                Enterprise Asset & Document Management Platform
              </p>
            </div>
            
            <div className="space-y-6 text-left">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Secure Asset Management</h3>
                  <p className="text-slate-400">Track and manage enterprise assets with role-based access control</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Network className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Multi-tenant Architecture</h3>
                  <p className="text-slate-400">Support multiple organizations with isolated data and customizable features</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Zap className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Advanced Reporting</h3>
                  <p className="text-slate-400">Real-time analytics and insights for informed decision making</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Side - Auth Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="backdrop-blur-xl bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl mb-4">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Administrator Access</h2>
                <p className="text-slate-400">Enter your credentials to access the management platform</p>
              </div>
              
              <div className="w-full space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">System Login</h3>
                  <p className="text-slate-400 text-sm">Secure access for authorized personnel</p>
                </div>

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
                        Access Platform
                      </>
                    )}
                  </Button>
                </form>
              </div>
              
              {/* System Status Indicator */}
              <div className="mt-6 flex items-center justify-center text-sm text-slate-400">
                <Activity className="h-4 w-4 text-green-400 mr-2 animate-pulse" />
                System Online
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}