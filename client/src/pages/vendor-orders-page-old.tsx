import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, DollarSign, Package, TrendingUp, X, Edit, Trash2, FileText, Filter, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NestedSelect } from "@/components/ui/nested-select";
import Dashboard from "@/components/layout/Dashboard";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Product {
  id: number;
  name: string;
  description?: string;
  category?: string;
  costPrice: number;
}

interface GroupedProducts {
  [category: string]: {
    id: number;
    name: string;
    description?: string;
  }[];
}

interface VendorOrder {
  id: number;
  vendorEmail: string;
  customerName: string;
  productId: number;
  quantity: number;
  buyingPrice: number;
  sellingPrice: number;
  totalCost: number;
  totalSale: number;
  profit: number;
  orderDate: string;
  product?: Product;
}

interface VendorStats {
  profit: number;
  orders: number;
  averageProfit: number;
}

interface VendorCustomer {
  id: number;
  customerName: string;
  customerEmail?: string;
}

interface VendorProductPrice {
  id: number;
  productId: number;
  buyingPrice: number;
  sellingPrice: number;
}

export default function VendorOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [groupedProducts, setGroupedProducts] = useState<GroupedProducts>({});
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [customers, setCustomers] = useState<VendorCustomer[]>([]);
  const [vendorPrices, setVendorPrices] = useState<VendorProductPrice[]>([]);
  const [stats, setStats] = useState<{
    today: VendorStats;
    week: VendorStats;
    month: VendorStats;
    year: VendorStats;
  }>({
    today: { profit: 0, orders: 0, averageProfit: 0 },
    week: { profit: 0, orders: 0, averageProfit: 0 },
    month: { profit: 0, orders: 0, averageProfit: 0 },
    year: { profit: 0, orders: 0, averageProfit: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingOrder, setEditingOrder] = useState<VendorOrder | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [reportRange, setReportRange] = useState<string>("weekly");
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    productId: "",
    customerName: "",
    quantity: "",
    buyingPrice: "",
    sellingPrice: ""
  });

  // Auto-fill prices when product is selected
  const handleProductChange = (productId: string) => {
    setFormData(prev => ({ ...prev, productId }));
    
    if (productId) {
      const price = vendorPrices.find(p => p.productId === parseInt(productId));
      if (price) {
        setFormData(prev => ({
          ...prev,
          productId,
          buyingPrice: (price.buyingPrice / 100).toString(),
          sellingPrice: (price.sellingPrice / 100).toString()
        }));
      }
    }
  };

  // Filters
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    productId: "all",
    customerName: ""
  });

  useEffect(() => {
    if (!user?.email) return;
    fetchData();
  }, [user?.email]);

  const fetchData = async () => {
    if (!user?.email) return;
    try {
      setLoading(true);
      // Fetch products for vendor (now returns grouped products)
      const productsResponse = await apiRequest('GET', '/api/vendor/products');
      const groupedProductsData = await productsResponse.json();
      setGroupedProducts(groupedProductsData);
      
      // Also maintain the flat products array for backward compatibility
      const flatProducts: Product[] = [];
      Object.entries(groupedProductsData).forEach(([category, items]) => {
        (items as any[]).forEach((item: any) => {
          flatProducts.push({
            id: item.id,
            name: item.name,
            description: item.description,
            category: category,
            costPrice: 0 // Will be filled from vendor prices
          });
        });
      });
      setProducts(flatProducts);
      
      // Fetch vendor customers
      const customersResponse = await apiRequest('GET', `/api/vendor/customers?vendorEmail=${user?.email}`);
      const customersData = await customersResponse.json();
      setCustomers(customersData);
      
      // Fetch vendor product prices
      const pricesResponse = await apiRequest('GET', `/api/vendor/product-prices?vendorEmail=${user?.email}`);
      const pricesData = await pricesResponse.json();
      setVendorPrices(pricesData);
      
      // Fetch vendor orders
      const ordersResponse = await apiRequest('GET', `/api/vendor-orders?vendorEmail=${user?.email}`);
      const ordersData = await ordersResponse.json();
      setOrders(ordersData);
      
      // Fetch vendor stats
      const statsResponse = await apiRequest('GET', `/api/vendor-orders/stats?vendorEmail=${user?.email}`);
      const statsData = await statsResponse.json();
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productId || !formData.customerName || !formData.quantity || !formData.buyingPrice || !formData.sellingPrice) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await apiRequest('POST', '/api/vendor-orders', {
        vendorEmail: user?.email,
        productId: parseInt(formData.productId),
        customerName: formData.customerName,
        quantity: parseInt(formData.quantity),
        buyingPrice: parseFloat(formData.buyingPrice) * 100, // Convert to cents
        sellingPrice: parseFloat(formData.sellingPrice) * 100, // Convert to cents
        orderDate: new Date().toISOString() // Add current date
      });

      toast({
        title: "Success",
        description: "Order created successfully",
      });
      
      // Reset form
      setFormData({
        productId: "",
        customerName: "",
        quantity: "",
        buyingPrice: "",
        sellingPrice: ""
      });
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Error",
        description: "Failed to create order",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100); // Convert from cents
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleEditOrder = (order: VendorOrder) => {
    setEditingOrder(order);
    setFormData({
      productId: order.productId.toString(),
      customerName: order.customerName,
      quantity: order.quantity.toString(),
      buyingPrice: (order.buyingPrice / 100).toString(),
      sellingPrice: (order.sellingPrice / 100).toString()
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingOrder || !formData.productId || !formData.customerName || !formData.quantity || !formData.buyingPrice || !formData.sellingPrice) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await apiRequest('PUT', `/api/vendor-orders/${editingOrder.id}`, {
        vendorEmail: user?.email,
        productId: parseInt(formData.productId),
        customerName: formData.customerName,
        quantity: parseInt(formData.quantity),
        buyingPrice: parseFloat(formData.buyingPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        orderDate: editingOrder.orderDate
      });

      toast({
        title: "Success",
        description: "Order updated successfully",
      });
      
      // Reset form and close modal
      setFormData({
        productId: "",
        customerName: "",
        quantity: "",
        buyingPrice: "",
        sellingPrice: ""
      });
      setEditingOrder(null);
      setIsEditModalOpen(false);
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to delete this order?')) {
      return;
    }

    try {
      const response = await apiRequest('DELETE', `/api/vendor-orders/${orderId}`);

      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive"
      });
    }
  };

  const handleDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      
      const response = await apiRequest('GET', `/api/vendor-orders/report?vendorEmail=${user?.email}&range=${reportRange}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendor_report_${reportRange}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: `Report downloaded successfully`,
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: "Error",
        description: "Failed to download report",
        variant: "destructive"
      });
    } finally {
      setDownloadingReport(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filters.dateFrom && new Date(order.orderDate) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(order.orderDate) > new Date(filters.dateTo)) return false;
    if (filters.productId && filters.productId !== "all" && order.productId !== parseInt(filters.productId)) return false;
    if (filters.customerName && !order.customerName.toLowerCase().includes(filters.customerName.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <Dashboard title="Vendor Orders" description="Manage your product orders and track profits">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard title="Vendor Orders" description="Manage your product orders and track profits">
      <div className="space-y-6">
        {/* Header with Create Order Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => setIsCreateOrderOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Order
            </Button>
            {user?.role === 'vendor' && (
              <div className="flex items-center gap-3">
                <Select value={reportRange} onValueChange={setReportRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleDownloadReport} 
                  disabled={downloadingReport}
                  variant="outline"
                >
                  {downloadingReport ? "Downloading..." : "Download Report"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Order History Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-2xl font-bold">Order History</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {filteredOrders.length} orders found
              </CardDescription>
            </div>
            {/* Filter Icon Button with Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="ml-2 hover:bg-muted">
                        <Filter className="h-6 w-6" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="dateFrom">Date From</Label>
                            <Input
                              id="dateFrom"
                              type="date"
                              value={filters.dateFrom}
                              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="dateTo">Date To</Label>
                            <Input
                              id="dateTo"
                              type="date"
                              value={filters.dateTo}
                              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="filterProduct">Product</Label>
                          <Select value={filters.productId} onValueChange={(value) => setFilters({ ...filters, productId: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="All products" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All products</SelectItem>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id.toString()}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="filterCustomer">Customer</Label>
                          <Input
                            id="filterCustomer"
                            type="text"
                            value={filters.customerName}
                            onChange={(e) => setFilters({ ...filters, customerName: e.target.value })}
                            placeholder="Search by customer name"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={clearFilters}>
                            Clear
                          </Button>
                          <Button onClick={() => setFilterPopoverOpen(false)}>
                            Apply
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filter orders</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Buying Price</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Total Sale</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.id}</TableCell>
                    <TableCell>{order.product?.name || 'Unknown Product'}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>{formatCurrency(order.buyingPrice)}</TableCell>
                    <TableCell>{formatCurrency(order.sellingPrice)}</TableCell>
                    <TableCell>{formatCurrency(order.totalCost)}</TableCell>
                    <TableCell>{formatCurrency(order.totalSale)}</TableCell>
                    <TableCell>
                      <Badge variant={order.profit > 0 ? "default" : "destructive"}>
                        {formatCurrency(order.profit)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(order.orderDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditOrder(order)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOrder(order.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create New Order Sheet */}
      <Sheet open={isCreateOrderOpen} onOpenChange={setIsCreateOrderOpen}>
        <SheetContent side="right" className="w-[600px] sm:w-[700px]">
          <SheetHeader>
            <SheetTitle>Create New Order</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="product">Product</Label>
                <NestedSelect
                  options={groupedProducts}
                  value={formData.productId}
                  onValueChange={handleProductChange}
                  placeholder="Select a product"
                  disabled={Object.keys(groupedProducts).length === 0}
                />
              </div>

              <div>
                <Label htmlFor="customerName">Customer</Label>
                <Select value={formData.customerName} onValueChange={(value) => setFormData({ ...formData, customerName: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.customerName}>
                        {customer.customerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <NumberInput
                  id="quantity"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="Enter quantity"
                  min="1"
                />
              </div>

              <div>
                <Label htmlFor="buyingPrice">Buying Price ($)</Label>
                <NumberInput
                  id="buyingPrice"
                  step="0.01"
                  value={formData.buyingPrice}
                  onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                  placeholder="Enter buying price (e.g., 25.50)"
                  min="0"
                  inputMode="decimal"
                />
              </div>

              <div>
                <Label htmlFor="sellingPrice">Selling Price ($)</Label>
                <NumberInput
                  id="sellingPrice"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  placeholder="Enter selling price (e.g., 35.75)"
                  min="0"
                  inputMode="decimal"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOrderOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Creating..." : "Create Order"}
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </Dashboard>
  );
}
          {/* Top Row: Create New Order and Download Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Create New Order */}
            <div>
              <Card className="shadow-xl rounded-2xl border-0">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">Create New Order</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">Add a new vendor order with product details</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="product">Product</Label>
                      <NestedSelect
                        options={groupedProducts}
                        value={formData.productId}
                        onValueChange={handleProductChange}
                        placeholder="Select a product"
                        disabled={Object.keys(groupedProducts).length === 0}
                      />
                    </div>

                    <div>
                      <Label htmlFor="customerName">Customer</Label>
                      <Select value={formData.customerName} onValueChange={(value) => setFormData({ ...formData, customerName: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.customerName}>
                              {customer.customerName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <NumberInput
                        id="quantity"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="Enter quantity"
                        min="1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="buyingPrice">Buying Price ($)</Label>
                      <NumberInput
                        id="buyingPrice"
                        step="0.01"
                        value={formData.buyingPrice}
                        onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                        placeholder="Enter buying price (e.g., 25.50)"
                        min="0"
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <Label htmlFor="sellingPrice">Selling Price ($)</Label>
                      <NumberInput
                        id="sellingPrice"
                        step="0.01"
                        value={formData.sellingPrice}
                        onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                        placeholder="Enter selling price (e.g., 35.75)"
                        min="0"
                        inputMode="decimal"
                      />
                    </div>

                    <Button type="submit" disabled={submitting} className="w-full">
                      {submitting ? "Creating..." : "Create Order"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right: Download Reports */}
            {user?.role === 'vendor' && (
              <div>
                <Card className="shadow-lg rounded-2xl border-0">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-teal-500" />
                      <CardTitle className="text-lg font-semibold">Download Reports</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Select value={reportRange} onValueChange={setReportRange}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={handleDownloadReport} 
                        disabled={downloadingReport}
                        className="min-w-[120px] bg-teal-400 hover:bg-teal-500 text-white font-semibold"
                      >
                        {downloadingReport ? "Downloading..." : "Download"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Bottom Row: Order History - Full Width */}
          <Card className="shadow-xl rounded-2xl border-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-2xl font-bold">Order History</CardTitle>
                <CardDescription className="text-base text-gray-500">
                  {filteredOrders.length} orders found
                </CardDescription>
              </div>
              {/* Filter Icon Button with Tooltip */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="ml-2 hover:bg-teal-100">
                          <Filter className="h-6 w-6 text-teal-600" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="dateFrom">Date From</Label>
                              <Input
                                id="dateFrom"
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="dateTo">Date To</Label>
                              <Input
                                id="dateTo"
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="filterProduct">Product</Label>
                            <Select value={filters.productId} onValueChange={(value) => setFilters({ ...filters, productId: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="All products" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All products</SelectItem>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id.toString()}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="filterCustomer">Customer</Label>
                            <Input
                              id="filterCustomer"
                              type="text"
                              value={filters.customerName}
                              onChange={(e) => setFilters({ ...filters, customerName: e.target.value })}
                              placeholder="Search by customer name"
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>Filter Orders</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-teal-50">
                    <TableRow>
                      <TableHead className="font-bold text-teal-700">Date</TableHead>
                      <TableHead className="font-bold text-teal-700">Customer</TableHead>
                      <TableHead className="font-bold text-teal-700">Product</TableHead>
                      <TableHead className="font-bold text-teal-700">Quantity</TableHead>
                      <TableHead className="font-bold text-teal-700">Buying Price</TableHead>
                      <TableHead className="font-bold text-teal-700">Selling Price</TableHead>
                      <TableHead className="font-bold text-teal-700">Total Cost</TableHead>
                      <TableHead className="font-bold text-teal-700">Total Sale</TableHead>
                      <TableHead className="font-bold text-teal-700">Profit</TableHead>
                      <TableHead className="font-bold text-teal-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-teal-50 transition-colors">
                        <TableCell>{formatDate(order.orderDate)}</TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell>
                          {order.product?.name || `Product ${order.productId}`}
                        </TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>{formatCurrency(order.buyingPrice)}</TableCell>
                        <TableCell>{formatCurrency(order.sellingPrice)}</TableCell>
                        <TableCell>{formatCurrency(order.totalCost)}</TableCell>
                        <TableCell>{formatCurrency(order.totalSale)}</TableCell>
                        <TableCell>
                          <Badge variant={order.profit >= 0 ? "default" : "destructive"}>
                            {formatCurrency(order.profit)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditOrder(order)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteOrder(order.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Order Modal */}
        {isEditModalOpen && editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Edit Order</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingOrder(null);
                    setFormData({
                      productId: "",
                      customerName: "",
                      quantity: "",
                      buyingPrice: "",
                      sellingPrice: ""
                    });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <form onSubmit={handleUpdateOrder} className="space-y-4">
                <div>
                  <Label htmlFor="edit-product">Product</Label>
                  <NestedSelect
                    options={groupedProducts}
                    value={formData.productId}
                    onValueChange={handleProductChange}
                    placeholder="Select a product"
                    disabled={Object.keys(groupedProducts).length === 0}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-customerName">Customer</Label>
                  <Select value={formData.customerName} onValueChange={(value) => setFormData({ ...formData, customerName: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.customerName}>
                          {customer.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-quantity">Quantity</Label>
                  <NumberInput
                    id="edit-quantity"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="Enter quantity"
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-buyingPrice">Buying Price ($)</Label>
                  <NumberInput
                    id="edit-buyingPrice"
                    step="0.01"
                    value={formData.buyingPrice}
                    onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                    placeholder="Enter buying price (e.g., 25.50)"
                    min="0"
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-sellingPrice">Selling Price ($)</Label>
                  <NumberInput
                    id="edit-sellingPrice"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="Enter selling price (e.g., 35.75)"
                    min="0"
                    inputMode="decimal"
                  />
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingOrder(null);
                      setFormData({
                        productId: "",
                        customerName: "",
                        quantity: "",
                        buyingPrice: "",
                        sellingPrice: ""
                      });
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? "Updating..." : "Update Order"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 