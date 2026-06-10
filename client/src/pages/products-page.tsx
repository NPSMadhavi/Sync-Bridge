import React, { useState } from 'react';
import Dashboard from "@/components/layout/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { 
  Package,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Search,
} from "lucide-react";
import { TableRowActions } from "@/components/ui/table-row-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

interface ProductFormData {
  name: string;
  description: string;
  category: string;
}

interface PriceFormData {
  productId: string;
  buyingPrice: string;
  sellingPrice: string;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPriceEditModalOpen, setIsPriceEditModalOpen] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<ProductPrice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [productForm, setProductForm] = useState<ProductFormData>({
    name: '',
    description: '',
    category: ''
  });
  
  const [priceForm, setPriceForm] = useState<PriceFormData>({
    productId: '',
    buyingPrice: '',
    sellingPrice: ''
  });

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['vendor-products'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/vendor/products');
      const data = await response.json();
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
      return data;
    },
    enabled: !!user
  });

  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const response = await apiRequest('POST', '/api/vendor/products', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Product Added",
        description: "Product has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
      setProductForm({ name: '', description: '', category: '' });
      setIsAddModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Add Failed",
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductFormData }) => {
      const response = await apiRequest('PUT', `/api/vendor/products/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Product Updated",
        description: "Product has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
      setProductForm({ name: '', description: '', category: '' });
      setIsEditModalOpen(false);
      setSelectedProduct(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/vendor/products/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to delete product');
      }
      return response;
    },
    onSuccess: (response) => {
      // Check if it was a soft delete (status 200) or hard delete (status 204)
      const isSoftDelete = response?.status === 200;
      
      toast({
        title: isSoftDelete ? "Product Deactivated" : "Product Deleted",
        description: isSoftDelete 
          ? "Product has been deactivated to preserve historical records." 
          : "Product has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-product-prices'] });
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Set price mutation
  const setPriceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/vendor/product-prices', {
        ...data,
        productId: parseInt(data.productId),
        vendorEmail: user?.email,
        buyingPrice: parseFloat(data.buyingPrice),
        sellingPrice: parseFloat(data.sellingPrice)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Price Set",
        description: "Product price has been set successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-product-prices'] });
      setPriceForm({ productId: '', buyingPrice: '', sellingPrice: '' });
      setIsPriceModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Set Price Failed",
        description: "Failed to set product price. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PUT', `/api/vendor/product-prices/${id}`, {
        buyingPrice: parseFloat(data.buyingPrice),
        sellingPrice: parseFloat(data.sellingPrice)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Price Updated",
        description: "Product price has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-product-prices'] });
      setIsPriceEditModalOpen(false);
      setSelectedPrice(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update product price. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete price mutation
  const deletePriceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/vendor/product-prices/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Price Deleted",
        description: "Product price has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['vendor-product-prices'] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete product price. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    addProductMutation.mutate(productForm);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductForm({
      name: product.name,
      description: product.description,
      category: product.category
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProduct) {
      updateProductMutation.mutate({ id: selectedProduct.id, data: productForm });
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteProduct = () => {
    if (selectedProduct) {
      deleteProductMutation.mutate(selectedProduct.id);
    }
  };

  const handleSetPrice = (e: React.FormEvent) => {
    e.preventDefault();
    setPriceMutation.mutate(priceForm);
  };

  const handleEditPrice = (price: ProductPrice) => {
    setSelectedPrice(price);
    setPriceForm({
      productId: price.productId.toString(),
      buyingPrice: (price.buyingPrice / 100).toFixed(2),
      sellingPrice: (price.sellingPrice / 100).toFixed(2)
    });
    setIsPriceEditModalOpen(true);
  };

  const handleUpdatePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPrice) {
      updatePriceMutation.mutate({ id: selectedPrice.id, data: priceForm });
    }
  };

  const handleDeletePrice = (price: ProductPrice) => {
    if (window.confirm('Are you sure you want to delete this price?')) {
      deletePriceMutation.mutate(price.id);
    }
  };

  // Flatten products for display and ensure category is set
  const allProducts = products ? Object.entries(products).flatMap(([category, categoryProducts]: [string, any]) => 
    categoryProducts.map((product: any) => ({ ...product, category }))
  ) : [];
  
  // Filter products based on search term
  const filteredProducts = allProducts.filter((product: any) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderProductTable = () => {
    if (productsLoading || pricesLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading products...</p>
          </div>
        </div>
      );
    }

    if (filteredProducts.length === 0) {
      return (
        <div className="text-center py-8">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No products found.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Prices</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.map((product: Product) => {
            const productPricesForProduct = productPrices?.filter((price: ProductPrice) => price.productId === product.id) || [];
            
            return (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{product.category}</Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">{product.description}</TableCell>
                <TableCell>
                  {productPricesForProduct.length > 0 ? (
                    (() => {
                      // Get the most recent price (highest ID = most recent)
                      const currentPrice = productPricesForProduct.reduce((latest, current) => 
                        current.id > latest.id ? current : latest
                      );
                      
                      return (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-600">
                            Buy: ${(currentPrice.buyingPrice / 100).toFixed(2)}
                          </span>
                          <span className="text-blue-600">
                            Sell: ${(currentPrice.sellingPrice / 100).toFixed(2)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPrice(currentPrice)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePrice(currentPrice)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-muted-foreground text-sm">No prices set</span>
                  )}
                </TableCell>
                <TableCell>
                  <TableRowActions
                    actions={[
                      {
                        icon: Edit,
                        label: "Edit Product",
                        variant: "edit",
                        onClick: () => handleEditProduct(product),
                      },
                      {
                        icon: Trash2,
                        label: "Delete Product",
                        variant: "delete",
                        onClick: () => handleDeleteProduct(product),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <Dashboard title="Products" description="Manage your products and their prices.">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsPriceModalOpen(true)}>
              <DollarSign className="mr-2 h-4 w-4" />
              Set Price
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Products ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderProductTable()}
        </CardContent>
      </Card>

      {/* Add Product Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
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
            <DialogFooter>
              <Button type="submit" disabled={addProductMutation.isPending}>
                {addProductMutation.isPending ? 'Adding...' : 'Add Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div>
              <Label htmlFor="edit-product-name">Product Name</Label>
              <Input
                id="edit-product-name"
                placeholder="Enter product name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-product-description">Description</Label>
              <Textarea
                id="edit-product-description"
                placeholder="Enter product description"
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-product-category">Category</Label>
              <Input
                id="edit-product-category"
                placeholder="Enter product category"
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateProductMutation.isPending}>
                {updateProductMutation.isPending ? 'Updating...' : 'Update Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Set Price Modal */}
      <Dialog open={isPriceModalOpen} onOpenChange={setIsPriceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Product Price</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSetPrice} className="space-y-4">
            <div>
              <Label htmlFor="price-product-select">Product</Label>
              <select
                id="price-product-select"
                className="w-full p-2 border rounded-md"
                value={priceForm.productId}
                onChange={(e) => setPriceForm({ ...priceForm, productId: e.target.value })}
                required
              >
                <option value="">Select a product</option>
                {allProducts.map((product: Product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="buying-price">Buying Price ($)</Label>
              <Input
                id="buying-price"
                type="number"
                step="0.01"
                placeholder="0.00"
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
                placeholder="0.00"
                value={priceForm.sellingPrice}
                onChange={(e) => setPriceForm({ ...priceForm, sellingPrice: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={setPriceMutation.isPending}>
                {setPriceMutation.isPending ? 'Setting...' : 'Set Price'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Price Modal */}
      <Dialog open={isPriceEditModalOpen} onOpenChange={setIsPriceEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product Price</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePrice} className="space-y-4">
            <div>
              <Label htmlFor="edit-buying-price">Buying Price ($)</Label>
              <Input
                id="edit-buying-price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={priceForm.buyingPrice}
                onChange={(e) => setPriceForm({ ...priceForm, buyingPrice: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-selling-price">Selling Price ($)</Label>
              <Input
                id="edit-selling-price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={priceForm.sellingPrice}
                onChange={(e) => setPriceForm({ ...priceForm, sellingPrice: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updatePriceMutation.isPending}>
                {updatePriceMutation.isPending ? 'Updating...' : 'Update Price'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.
              <br /><br />
              <strong>Note:</strong> If this product has any existing orders, it cannot be deleted to preserve historical records. 
              All associated prices will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProduct}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dashboard>
  );
}