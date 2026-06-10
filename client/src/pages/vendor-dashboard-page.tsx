import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, TrendingUp, TrendingDown, Users, Package, ShoppingCart, UserPlus, DollarSign, Calendar, BarChart3, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";

// Types for vendor dashboard data
interface ProfitData {
  daily: { amount: number; change: number };
  weekly: { amount: number; change: number };
  monthly: { amount: number; change: number };
  yearly: { amount: number; change: number };
}

interface EmployeeStats {
  total: number;
  active: number;
  departments: { name: string; count: number }[];
  recentHires: number;
}

interface ProductData {
  total: number;
  bestSellers: { name: string; sales: number }[];
  recentlyUpdated: { name: string; lastUpdated: string }[];
}

interface OrderSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  status: { completed: number; pending: number; cancelled: number };
}

interface CustomerStats {
  total: number;
  newThisMonth: number;
  growthRate: number;
}

interface ExpenseData {
  monthlyPayroll: number;
  netProfitAfterExpenses: number;
  profitVsExpense: { profit: number; expense: number }[];
}

export default function VendorDashboardPage() {
  const { user, tenantId } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  // Fetch vendor dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/vendor/dashboard"],
    queryFn: () => apiRequest("GET", "/api/vendor/dashboard").then((res: Response) => res.json()),
    enabled: !!user && !!tenantId,
    staleTime: 0, // Consider data stale immediately - refresh on every mount
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  const handleRefresh = () => {
    refetch();
  };

  // Mock data for demonstration (replace with actual API data)
  const mockData = {
    profit: {
      daily: { amount: 1250, change: 12.5 },
      weekly: { amount: 8750, change: -3.2 },
      monthly: { amount: 35200, change: 8.7 },
      yearly: { amount: 425000, change: 15.3 }
    },
    employees: {
      total: 45,
      active: 42,
      departments: [
        { name: "Sales", count: 12 },
        { name: "Engineering", count: 18 },
        { name: "Marketing", count: 8 },
        { name: "Support", count: 7 },
        { name: "Product Management", count: 5 },
        { name: "Quality Assurance", count: 4 },
        { name: "DevOps", count: 3 },
        { name: "Data Science", count: 2 },
        { name: "UX/UI Design", count: 3 },
        { name: "Business Development", count: 2 }
      ],
      recentHires: 3
    },
    products: {
      total: 156,
      bestSellers: [
        { name: "Premium Widget", sales: 234 },
        { name: "Standard Tool", sales: 189 },
        { name: "Deluxe Package", sales: 156 },
        { name: "Basic Kit", sales: 134 },
        { name: "Pro Solution", sales: 98 },
        { name: "Advanced Module", sales: 87 },
        { name: "Enterprise Suite", sales: 76 },
        { name: "Cloud Service", sales: 65 },
        { name: "Mobile App", sales: 54 },
        { name: "API Integration", sales: 43 },
        { name: "Security Package", sales: 32 },
        { name: "Analytics Tool", sales: 21 }
      ],
      recentlyUpdated: [
        { name: "Smart Device v2.1", lastUpdated: "2024-01-15" },
        { name: "Eco-Friendly Material", lastUpdated: "2024-01-14" },
        { name: "Safety Equipment", lastUpdated: "2024-01-13" },
        { name: "Cloud Platform v3.0", lastUpdated: "2024-01-12" },
        { name: "Mobile SDK Update", lastUpdated: "2024-01-11" },
        { name: "API Documentation", lastUpdated: "2024-01-10" },
        { name: "Security Patch", lastUpdated: "2024-01-09" },
        { name: "Performance Update", lastUpdated: "2024-01-08" },
        { name: "UI/UX Redesign", lastUpdated: "2024-01-07" },
        { name: "Database Migration", lastUpdated: "2024-01-06" }
      ]
    },
    orders: {
      today: 23,
      thisWeek: 156,
      thisMonth: 642,
      status: { completed: 589, pending: 38, cancelled: 15 }
    },
    customers: {
      total: 1247,
      newThisMonth: 89,
      growthRate: 7.2
    },
    expenses: {
      monthlyPayroll: 125000,
      netProfitAfterExpenses: 227000,
      profitVsExpense: [
        { profit: 352000, expense: 125000 },
        { profit: 325000, expense: 118000 },
        { profit: 298000, expense: 122000 }
      ]
    }
  };

  const data = dashboardData || mockData;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Error Loading Dashboard</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Vendor Dashboard</h1>
              <p className="text-muted-foreground mt-1">Overview of your business performance</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-600 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 hover:border-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="space-y-6">
            {/* Profit Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ProfitCard
                title="Daily Profit"
                amount={data.profit.daily.amount}
                change={data.profit.daily.change}
                icon={<DollarSign className="h-6 w-6" />}
                gradient="from-teal-400 to-teal-600"
              />
              <ProfitCard
                title="Weekly Profit"
                amount={data.profit.weekly.amount}
                change={data.profit.weekly.change}
                icon={<Calendar className="h-6 w-6" />}
                gradient="from-teal-500 to-teal-700"
              />
              <ProfitCard
                title="Monthly Profit"
                amount={data.profit.monthly.amount}
                change={data.profit.monthly.change}
                icon={<BarChart3 className="h-6 w-6" />}
                gradient="from-teal-600 to-teal-800"
              />
              <ProfitCard
                title="Yearly Profit"
                amount={data.profit.yearly.amount}
                change={data.profit.yearly.change}
                icon={<TrendingUp className="h-6 w-6" />}
                gradient="from-teal-700 to-teal-900"
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer Stats */}
              <div className="lg:col-span-1">
                <CustomerStatsCard data={data.customers} />
              </div>

              {/* Product Overview */}
              <div className="lg:col-span-1">
                <ProductOverviewCard data={data.products} />
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <OrderSummaryCard data={data.orders} />
              </div>
            </div>

            {/* Employee Stats - Separate Row */}
            <div>
              <EmployeeStatsCard data={data.employees} />
            </div>

            {/* Expense Overview */}
            <div>
              <ExpenseOverviewCard data={data.expenses} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Profit Card Component
function ProfitCard({ title, amount, change, icon, gradient }: {
  title: string;
  amount: number;
  change: number;
  icon: React.ReactNode;
  gradient: string;
}) {
  const isPositive = change >= 0;
  
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105">
      <CardContent className="p-6">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4", `bg-gradient-to-r ${gradient}`)}>
          {icon}
        </div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <div className={cn("flex items-center text-sm font-medium", isPositive ? "text-green-600" : "text-red-600")}>
            {isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
            {Math.abs(change)}%
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">${amount.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

// Employee Stats Card
function EmployeeStatsCard({ data }: { data: EmployeeStats }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <Users className="h-5 w-5 mr-2 text-teal-600" />
          Employee Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-teal-500/10 rounded-lg">
            <p className="text-2xl font-bold text-teal-600">{data.total}</p>
            <p className="text-sm text-muted-foreground">Total Employees</p>
          </div>
          <div className="text-center p-4 bg-green-500/10 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{data.active}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
        </div>

        {/* Department Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Department Breakdown</h4>
          <div className="max-h-32 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {data.departments.map((dept, index) => (
              <div key={dept.name} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{dept.name}</span>
                <div className="flex items-center">
                  <div className="w-16 bg-muted rounded-full h-2 mr-2">
                    <div 
                      className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(dept.count / data.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">{dept.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Hires */}
        <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
          <div className="flex items-center">
            <UserPlus className="h-4 w-4 text-blue-600 mr-2" />
            <span className="text-sm text-muted-foreground">Recent Hires</span>
          </div>
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
            {data.recentHires} this month
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// Product Overview Card
function ProductOverviewCard({ data }: { data: ProductData }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <Package className="h-5 w-5 mr-2 text-teal-600" />
          Product Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Products */}
        <div className="text-center p-4 bg-gradient-to-r from-teal-500/10 to-blue-500/10 rounded-lg">
          <p className="text-3xl font-bold text-teal-600">{data.total}</p>
          <p className="text-sm text-muted-foreground">Total Products</p>
        </div>

        {/* Best Sellers */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Top 5 Best Sellers</h4>
          <div className="max-h-36 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {data.bestSellers.map((product, index) => (
              <div key={product.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-foreground mr-2">{index + 1}.</span>
                  <span className="text-sm text-muted-foreground">{product.name}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-20 bg-muted rounded-full h-2 mr-2">
                    <div 
                      className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(product.sales / data.bestSellers[0].sales) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">{product.sales}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recently Updated */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Recently Updated</h4>
          <div className="max-h-24 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
            {data.recentlyUpdated.map((product) => (
              <div key={product.name} className="flex items-center justify-between p-2 bg-orange-500/10 rounded-lg">
                <span className="text-sm text-muted-foreground">{product.name}</span>
                <span className="text-xs text-muted-foreground">{product.lastUpdated}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Order Summary Card
function OrderSummaryCard({ data }: { data: OrderSummary }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <ShoppingCart className="h-5 w-5 mr-2 text-teal-600" />
          Order Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Order Counts */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-500/10 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{data.today}</p>
            <p className="text-sm text-muted-foreground">Today</p>
          </div>
          <div className="text-center p-4 bg-purple-500/10 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{data.thisWeek}</p>
            <p className="text-sm text-muted-foreground">This Week</p>
          </div>
          <div className="text-center p-4 bg-indigo-500/10 rounded-lg">
            <p className="text-2xl font-bold text-indigo-600">{data.thisMonth}</p>
            <p className="text-sm text-muted-foreground">This Month</p>
          </div>
        </div>

        {/* Order Status */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Order Status</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-muted-foreground">Completed</span>
              </div>
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/20">
                {data.status.completed}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/20">
                {data.status.pending}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm text-muted-foreground">Cancelled</span>
              </div>
              <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/20">
                {data.status.cancelled}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Customer Stats Card
function CustomerStatsCard({ data }: { data: CustomerStats }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <Users className="h-5 w-5 mr-2 text-teal-600" />
          Customer Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Customers */}
        <div className="text-center">
          <div className="relative inline-block">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="36"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-muted"
              />
              <circle
                cx="48"
                cy="48"
                r="36"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - data.growthRate / 100)}`}
                className="text-teal-500 transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{data.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Growth Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-green-500/10 rounded-lg">
            <p className="text-xl font-bold text-green-600">+{data.newThisMonth}</p>
            <p className="text-sm text-muted-foreground">New This Month</p>
          </div>
          <div className="text-center p-4 bg-teal-500/10 rounded-lg">
            <p className="text-xl font-bold text-teal-600">+{data.growthRate}%</p>
            <p className="text-sm text-muted-foreground">Growth Rate</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Expense Overview Card
function ExpenseOverviewCard({ data }: { data: ExpenseData }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <DollarSign className="h-5 w-5 mr-2 text-teal-600" />
          Expense Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Monthly Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-red-500/10 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">Monthly Expenditure</h4>
            <p className="text-3xl font-bold text-red-600">${data.monthlyPayroll.toLocaleString()}</p>
          </div>
          <div className="p-6 bg-green-500/10 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">Net Profit After Expenses</h4>
            <p className="text-3xl font-bold text-green-600">${data.netProfitAfterExpenses.toLocaleString()}</p>
          </div>
        </div>

        {/* Profit vs Expense Chart */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Last 3 Months - Expenses vs Profit</h4>
          <div className="space-y-3">
            {data.profitVsExpense.map((item, index) => {
              // Calculate the month names for the last 3 months
              const currentDate = new Date();
              const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - (2 - index), 1);
              const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium text-foreground">{monthName}</span>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">${item.profit.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Profit</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">${item.expense.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Expense</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 