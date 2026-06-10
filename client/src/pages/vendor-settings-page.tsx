import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { 
  Package,
  DollarSign,
  Users,
  X,
  Plus,
  Trash2
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  tenantId: number;
}

interface ProductPrice {
  id: number;
  productId: number;
  productName: string;
  buyingPrice: number;
  sellingPrice: number;
  vendorEmail: string;
}

interface Customer {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  vendorEmail: string;
}

export default function VendorSettingsPage() {
  const [activeSection, setActiveSection] = useState("add-product");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category: ''
  });

  const [priceForm, setPriceForm] = useState({
    productId: '',
    buyingPrice: '',
    sellingPrice: ''
  });

  const [customerForm, setCustomerForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: ''
  });

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['vendor-products'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/vendor/products');
      const data = await response.json();
      console.log('Products API response:', data); // Debug log
      return data;
    },
    enabled: !!user
  });

  // Fetch product prices
  const { data: productPrices, isLoading: pricesLoading } = useQuery({
    queryKey: ['vendor-product-prices'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/vendor/product-prices?vendorEmail=${user?.email}`);
      const data = await response.json();
      console.log('Product prices API response:', data); // Debug log
      return data;
    },
    enabled: !!user
  });

  // Fetch customers
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['vendor-customers'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/vendor/customers?vendorEmail=${user?.email}`);
      const data = await response.json();
      console.log('Customers API response:', data); // Debug log
      return data;
    },
    enabled: !!user
  });

  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Adding product with data:', data); // Debug log
      const response = await apiRequest('POST', '/api/vendor/products', data);
      const result = await response.json();
      console.log('Add product response:', result); // Debug log
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Product Added",
        description: "Product has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
      setProductForm({ name: '', description: '', category: '' });
    },
    onError: (error) => {
      console.error('Add product error:', error); // Debug log
      toast({
        title: "Add Failed",
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Set price mutation
  const setPriceMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Setting price with data:', data); // Debug log
      const response = await apiRequest('POST', '/api/vendor/product-prices', data);
      const result = await response.json();
      console.log('Set price response:', result); // Debug log
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Price Set",
        description: "Product price has been set successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-product-prices'] });
      setPriceForm({ productId: '', buyingPrice: '', sellingPrice: '' });
    },
    onError: (error) => {
      console.error('Set price error:', error); // Debug log
      toast({
        title: "Set Price Failed",
        description: "Failed to set product price. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add customer mutation
  const addCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/vendor/customers', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Customer Added",
        description: "Customer has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-customers'] });
      setCustomerForm({ customerName: '', customerEmail: '', customerPhone: '', customerAddress: '' });
    },
    onError: (error) => {
      toast({
        title: "Add Failed",
        description: "Failed to add customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: number) => {
      await apiRequest('DELETE', `/api/vendor/customers/${customerId}`);
    },
    onSuccess: () => {
      toast({
        title: "Customer Deleted",
        description: "Customer has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-customers'] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    addProductMutation.mutate(productForm);
  };

  const handleSetPrice = (e: React.FormEvent) => {
    e.preventDefault();
    setPriceMutation.mutate({
      ...priceForm,
      productId: parseInt(priceForm.productId), // Convert to integer
      vendorEmail: user?.email,
      buyingPrice: parseFloat(priceForm.buyingPrice),
      sellingPrice: parseFloat(priceForm.sellingPrice)
    });
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    addCustomerMutation.mutate({
      ...customerForm,
      vendorEmail: user?.email
    });
  };

  const handleDeleteCustomer = (customerId: number) => {
    deleteCustomerMutation.mutate(customerId);
  };

  if (productsLoading || pricesLoading || customersLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading vendor settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Settings</h1>
          <p className="text-muted-foreground">Manage your products, prices, and customers.</p>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => window.history.back()}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Left Navigation */}
        <div className="w-64 space-y-2">
          <button
            onClick={() => setActiveSection("add-product")}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeSection === "add-product" 
                ? "bg-muted text-foreground" 
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Add Product
          </button>
          <button
            onClick={() => setActiveSection("set-prices")}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeSection === "set-prices" 
                ? "bg-muted text-foreground" 
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Set Product Prices
          </button>
          <button
            onClick={() => setActiveSection("add-customers")}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeSection === "add-customers" 
                ? "bg-muted text-foreground" 
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Add Customers
          </button>
        </div>

        {/* Right Content Panel */}
        <div className="flex-1">
          {activeSection === "add-product" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Add Product
                </CardTitle>
                <p className="text-sm text-muted-foreground">Add new products to your catalog.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddProduct} className="space-y-4">
                  <div>
                    <Label htmlFor="product-name">Product Name</Label>
                    <Input
                      id="product-name"
                      placeholder="Enter product name"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="product-description">Description</Label>
                    <Textarea
                      id="product-description"
                      placeholder="Enter product description"
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="product-category">Category</Label>
                    <Input
                      id="product-category"
                      placeholder="Enter product category"
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={addProductMutation.isPending} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    {addProductMutation.isPending ? 'Adding...' : 'Add Product'}
                  </Button>
                </form>

                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Current Products</h3>
                  {products && Object.entries(products).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(products).map(([category, categoryProducts]: [string, any]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{category}</div>
                          {categoryProducts.map((product: any) => (
                            <div key={product.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                              <span>{product.name}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No products added yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "set-prices" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Set Product Prices
                </CardTitle>
                <p className="text-sm text-muted-foreground">Set buying and selling prices for your products.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSetPrice} className="space-y-4">
                  <div>
                    <Label htmlFor="product-select">Product</Label>
                    <Select value={priceForm.productId} onValueChange={(value) => setPriceForm({ ...priceForm, productId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder={productsLoading ? "Loading products..." : "Select a product"} />
                      </SelectTrigger>
                      <SelectContent>
                        {console.log('Products in dropdown:', products)} {/* Debug log */}
                        {console.log('Products loading:', productsLoading)} {/* Debug log */}
                        {productsLoading ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading products...</div>
                        ) : products && Object.entries(products).length > 0 ? (
                          Object.entries(products).map(([category, categoryProducts]: [string, any]) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{category}</div>
                              {categoryProducts.map((product: any) => (
                                <SelectItem key={product.id} value={product.id.toString()}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </div>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No products available</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="buying-price">Buying Price ($)</Label>
                    <Input
                      id="buying-price"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={priceForm.buyingPrice}
                      onChange={(e) => setPriceForm({ ...priceForm, buyingPrice: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="selling-price">Selling Price ($)</Label>
                    <Input
                      id="selling-price"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={priceForm.sellingPrice}
                      onChange={(e) => setPriceForm({ ...priceForm, sellingPrice: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={setPriceMutation.isPending} className="w-full">
                    <DollarSign className="mr-2 h-4 w-4" />
                    {setPriceMutation.isPending ? 'Setting...' : 'Set Price'}
                  </Button>
                </form>

                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Current Prices</h3>
                  {productPrices && productPrices.length > 0 ? (
                    <div className="space-y-2">
                      {productPrices.map((price: ProductPrice) => (
                        <div key={price.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{price.productName}</p>
                            <p className="text-sm text-muted-foreground">
                              Buy: ${(price.buyingPrice / 100).toFixed(2)} | Sell: ${(price.sellingPrice / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No prices set yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "add-customers" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Add Customers
                </CardTitle>
                <p className="text-sm text-muted-foreground">Add new customers to your customer list.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddCustomer} className="space-y-4">
                  <div>
                    <Label htmlFor="customer-name">Customer Name</Label>
                    <Input
                      id="customer-name"
                      placeholder="Enter customer name"
                      value={customerForm.customerName}
                      onChange={(e) => setCustomerForm({ ...customerForm, customerName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer-email">Email</Label>
                    <Input
                      id="customer-email"
                      type="email"
                      placeholder="Enter customer email"
                      value={customerForm.customerEmail}
                      onChange={(e) => setCustomerForm({ ...customerForm, customerEmail: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer-phone">Phone</Label>
                    <Input
                      id="customer-phone"
                      placeholder="Enter customer phone"
                      value={customerForm.customerPhone}
                      onChange={(e) => setCustomerForm({ ...customerForm, customerPhone: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer-address">Address</Label>
                    <Textarea
                      id="customer-address"
                      placeholder="Enter customer address"
                      value={customerForm.customerAddress}
                      onChange={(e) => setCustomerForm({ ...customerForm, customerAddress: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={addCustomerMutation.isPending} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    {addCustomerMutation.isPending ? 'Adding...' : 'Add Customer'}
                  </Button>
                </form>

                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Current Customers</h3>
                  {customers && customers.length > 0 ? (
                    <div className="space-y-2">
                      {customers.map((customer: Customer) => (
                        <div key={customer.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{customer.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                              Email: {customer.customerEmail} | Phone: {customer.customerPhone}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCustomer(customer.id)}
                            disabled={deleteCustomerMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No customers added yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
} 