import { Router } from "express";
import { storage } from "../storage";
import { insertProductSchema, insertVendorProductPriceSchema, insertVendorCustomerSchema } from "@shared/schema";
import { and } from 'drizzle-orm';
import { requireTenant } from "../middleware/tenant";

const router = Router();

// Get vendor profile
router.get("/profile", requireTenant, async (req, res) => {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user is a vendor
    if (user.role !== 'vendor') {
      return res.status(403).json({ message: "Access denied. Vendor role required." });
    }

    // Get vendor data from the vendors table
    const vendors = await storage.getVendors(tenant.id);
    const vendor = vendors.find(v => v.email === user.email);
    
    if (!vendor) {
      return res.status(404).json({ message: "Vendor profile not found" });
    }

    // Format the response to match the frontend interface
    const profile = {
      id: vendor.id.toString(),
      company_name: vendor.name,
      contact_person: vendor.contact,
      email: vendor.email,
      phone: vendor.phone || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      postal_code: vendor.zipCode || '',
      country: vendor.country || '',
      website: vendor.website || '',
      tax_id: vendor.taxId || '',
      business_license: vendor.registrationNumber || '',
      description: vendor.notes || '',
      logo_url: undefined,
      created_at: vendor.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json(profile);
  } catch (error) {
    console.error("Error fetching vendor profile:", error);
    res.status(500).json({ message: "Failed to fetch vendor profile" });
  }
});

// Update vendor profile
router.put("/profile", requireTenant, async (req, res) => {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user is a vendor
    if (user.role !== 'vendor') {
      return res.status(403).json({ message: "Access denied. Vendor role required." });
    }

    // Get vendor data from the vendors table
    const vendors = await storage.getVendors(tenant.id);
    const vendor = vendors.find(v => v.email === user.email);
    
    if (!vendor) {
      return res.status(404).json({ message: "Vendor profile not found" });
    }

    // Update vendor data
    const updateData = {
      name: req.body.company_name,
      contact: req.body.contact_person,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      zipCode: req.body.postal_code,
      country: req.body.country,
      website: req.body.website,
      taxId: req.body.tax_id,
      registrationNumber: req.body.business_license,
      notes: req.body.description
    };

    const updatedVendor = await storage.updateVendor(vendor.id, updateData);
    
    if (!updatedVendor) {
      return res.status(500).json({ message: "Failed to update vendor profile" });
    }

    // Format the response to match the frontend interface
    const profile = {
      id: updatedVendor.id.toString(),
      company_name: updatedVendor.name,
      contact_person: updatedVendor.contact,
      email: updatedVendor.email,
      phone: updatedVendor.phone || '',
      address: updatedVendor.address || '',
      city: updatedVendor.city || '',
      state: updatedVendor.state || '',
      postal_code: updatedVendor.zipCode || '',
      country: updatedVendor.country || '',
      website: updatedVendor.website || '',
      tax_id: updatedVendor.taxId || '',
      business_license: updatedVendor.registrationNumber || '',
      description: updatedVendor.notes || '',
      logo_url: undefined,
      created_at: updatedVendor.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json(profile);
  } catch (error) {
    console.error("Error updating vendor profile:", error);
    res.status(500).json({ message: "Failed to update vendor profile" });
  }
});

// Get vendor settings
router.get("/settings", requireTenant, async (req, res) => {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user is a vendor
    if (user.role !== 'vendor') {
      return res.status(403).json({ message: "Access denied. Vendor role required." });
    }

    // For now, return default settings since we don't have a vendor_settings table
    // You can create a vendor_settings table later if needed
    const settings = {
      id: "1",
      vendor_id: user.id.toString(),
      email_notifications: true,
      sms_notifications: false,
      order_confirmations: true,
      payment_reminders: true,
      marketing_emails: false,
      theme: 'light' as const,
      language: 'en',
      timezone: 'UTC',
      currency: 'USD',
      auto_approve_orders: false,
      require_po_numbers: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json(settings);
  } catch (error) {
    console.error("Error fetching vendor settings:", error);
    res.status(500).json({ message: "Failed to fetch vendor settings" });
  }
});

// Update vendor settings
router.put("/settings", requireTenant, async (req, res) => {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user is a vendor
    if (user.role !== 'vendor') {
      return res.status(403).json({ message: "Access denied. Vendor role required." });
    }

    // For now, just return success since we don't have a vendor_settings table
    // You can create a vendor_settings table later if needed
    const settings = {
      id: "1",
      vendor_id: user.id.toString(),
      email_notifications: req.body.email_notifications ?? true,
      sms_notifications: req.body.sms_notifications ?? false,
      order_confirmations: req.body.order_confirmations ?? true,
      payment_reminders: req.body.payment_reminders ?? true,
      marketing_emails: req.body.marketing_emails ?? false,
      theme: req.body.theme ?? 'light',
      language: req.body.language ?? 'en',
      timezone: req.body.timezone ?? 'UTC',
      currency: req.body.currency ?? 'USD',
      auto_approve_orders: req.body.auto_approve_orders ?? false,
      require_po_numbers: req.body.require_po_numbers ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json(settings);
  } catch (error) {
    console.error("Error updating vendor settings:", error);
    res.status(500).json({ message: "Failed to update vendor settings" });
  }
});

// Get all products for the current vendor's tenant
router.get("/products", requireTenant, async (req, res) => {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user belongs to the tenant (unless super admin)
    if (user?.role !== 'super_admin' && !user?.isSuperAdmin && user?.tenantId !== tenant?.id) {
      return res.status(403).json({ message: "Access denied: User does not belong to this tenant" });
    }
    
    // Determine which tenant ID to use for product filtering
    let tenantIdForProducts = tenant?.id;
    
    // If no tenant context but user has a tenantId, use that
    if (!tenantIdForProducts && user?.tenantId) {
      tenantIdForProducts = user.tenantId;
    }
    
    // For super admins, show all products if no specific tenant context
    if (user?.role === 'super_admin' || user?.isSuperAdmin) {
      tenantIdForProducts = undefined; // Show all products
    }
    
    // Get products for the tenant
    const products = await storage.getProducts(tenantIdForProducts);
    
    // Group products by category
    const groupedProducts = products.reduce((acc, product) => {
      const category = product.category || 'UNCATEGORIZED';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        id: product.id,
        name: product.name,
        description: product.description || undefined
      });
      return acc;
    }, {} as Record<string, { id: number; name: string; description?: string }[]>);
    
    res.json(groupedProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// Create a new product
router.post("/products", requireTenant, async (req, res) => {
  try {
    const tenant = (req as any).tenant;
    const validatedData = insertProductSchema.parse({
      ...req.body,
      tenantId: tenant.id
    });
    const product = await storage.createProduct(validatedData);
    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(400).json({ message: "Failed to create product" });
  }
});

// Update a product
router.put("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const validatedData = insertProductSchema.partial().parse(req.body);
    const product = await storage.updateProduct(id, validatedData);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    res.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(400).json({ message: "Failed to update product" });
  }
});

// Delete a product (soft delete - marks as inactive instead of hard delete)
router.delete("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`Attempting to delete product ID: ${id}`);
    
    // Check if there are any vendor orders for this product
    const { db } = await import('../db');
    const { vendorOrders, vendorProductPrices, products } = await import('@shared/schema');
    const { eq, count } = await import('drizzle-orm');
    
    // First, check if the product exists
    const [existingProduct] = await db
      .select({ id: products.id, name: products.name, isActive: products.isActive })
      .from(products)
      .where(eq(products.id, id));
    
    if (!existingProduct) {
      console.log(`Product ID ${id} does not exist`);
      return res.status(404).json({ 
        message: "Product not found",
        error: `Product with ID ${id} does not exist.`
      });
    }
    
    console.log(`Product found: ${existingProduct.name} (ID: ${existingProduct.id})`);
    
    // Check for existing vendor orders
    console.log(`Checking for orders for product ID: ${id}`);
    const [orderCount] = await db
      .select({ count: count() })
      .from(vendorOrders)
      .where(eq(vendorOrders.productId, id));
    
    console.log(`Found ${orderCount.count} orders for product ID: ${id}`);
    
    if (orderCount.count > 0) {
      console.log(`Product has ${orderCount.count} orders - performing soft delete`);
      
      // Soft delete: mark product as inactive instead of deleting it
      await db
        .update(products)
        .set({ isActive: false })
        .where(eq(products.id, id));
      
      console.log(`Successfully soft deleted product ID: ${id} (marked as inactive)`);
      res.status(200).json({ 
        message: "Product deactivated successfully",
        note: `Product has been deactivated because it has ${orderCount.count} existing order(s). Historical records are preserved.`
      });
    } else {
      console.log(`No orders found, proceeding with hard deletion for product ID: ${id}`);
      
      // Hard delete: no orders exist, safe to delete completely
      // Delete vendor product prices associated with this product first
      console.log(`Deleting vendor product prices for product ID: ${id}`);
      await db.delete(vendorProductPrices).where(eq(vendorProductPrices.productId, id));
      
      // Now delete the product completely
      console.log(`Deleting product ID: ${id}`);
      await db.delete(products).where(eq(products.id, id));
      console.log(`Successfully hard deleted product ID: ${id}`);
      res.status(204).send();
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
});

// Get vendor product prices
router.get("/product-prices", async (req, res) => {
  try {
    const vendorEmail = req.query.vendorEmail as string;
    if (!vendorEmail) {
      return res.status(400).json({ message: "vendorEmail is required" });
    }
    
    const prices = await storage.getVendorProductPrices(vendorEmail);
    res.json(prices);
  } catch (error) {
    console.error("Error fetching vendor product prices:", error);
    res.status(500).json({ message: "Failed to fetch vendor product prices" });
  }
});

// Create vendor product price
router.post("/product-prices", async (req, res) => {
  try {
    console.log('Received product price data:', req.body); // Debug log
    const { buyingPrice, sellingPrice, ...otherData } = req.body;
    
    // Convert dollar amounts to cents (exact values)
    const buyingPriceCents = Math.round(parseFloat(buyingPrice) * 100);
    const sellingPriceCents = Math.round(parseFloat(sellingPrice) * 100);
    
    const dataToValidate = {
      ...otherData,
      buyingPrice: buyingPriceCents,
      sellingPrice: sellingPriceCents,
    };
    
    console.log('Data to validate:', dataToValidate); // Debug log
    
    const validatedData = insertVendorProductPriceSchema.parse(dataToValidate);
    console.log('Validated data:', validatedData); // Debug log
    
    const price = await storage.createVendorProductPrice(validatedData);
    res.status(201).json(price);
  } catch (error) {
    console.error("Error creating vendor product price:", error);
    console.error("Error details:", JSON.stringify(error, null, 2)); // Debug log
    res.status(400).json({ message: "Failed to create vendor product price", error: error.message });
  }
});

// Update vendor product price
router.put("/product-prices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { buyingPrice, sellingPrice, ...otherData } = req.body;
    
    // Convert dollar amounts to cents if provided (exact values)
    const updateData: any = { ...otherData };
    if (buyingPrice !== undefined) {
      updateData.buyingPrice = Math.round(parseFloat(buyingPrice) * 100);
    }
    if (sellingPrice !== undefined) {
      updateData.sellingPrice = Math.round(parseFloat(sellingPrice) * 100);
    }
    
    const validatedData = insertVendorProductPriceSchema.partial().parse(updateData);
    const price = await storage.updateVendorProductPrice(id, validatedData);
    
    if (!price) {
      return res.status(404).json({ message: "Vendor product price not found" });
    }
    
    res.json(price);
  } catch (error) {
    console.error("Error updating vendor product price:", error);
    res.status(400).json({ message: "Failed to update vendor product price" });
  }
});

// Delete vendor product price
router.delete("/product-prices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteVendorProductPrice(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting vendor product price:", error);
    res.status(500).json({ message: "Failed to delete vendor product price" });
  }
});

// Get vendor customers
router.get("/customers", async (req, res) => {
  try {
    const vendorEmail = req.query.vendorEmail as string;
    if (!vendorEmail) {
      return res.status(400).json({ message: "vendorEmail is required" });
    }
    
    const customers = await storage.getVendorCustomers(vendorEmail);
    res.json(customers);
  } catch (error) {
    console.error("Error fetching vendor customers:", error);
    res.status(500).json({ message: "Failed to fetch vendor customers" });
  }
});

// Create vendor customer
router.post("/customers", async (req, res) => {
  try {
    const validatedData = insertVendorCustomerSchema.parse(req.body);
    const customer = await storage.createVendorCustomer(validatedData);
    res.status(201).json(customer);
  } catch (error) {
    console.error("Error creating vendor customer:", error);
    res.status(400).json({ message: "Failed to create vendor customer" });
  }
});

// Update vendor customer
router.put("/customers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const validatedData = insertVendorCustomerSchema.partial().parse(req.body);
    const customer = await storage.updateVendorCustomer(id, validatedData);
    
    if (!customer) {
      return res.status(404).json({ message: "Vendor customer not found" });
    }
    
    res.json(customer);
  } catch (error) {
    console.error("Error updating vendor customer:", error);
    res.status(400).json({ message: "Failed to update vendor customer" });
  }
});

// Delete vendor customer
router.delete("/customers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteVendorCustomer(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting vendor customer:", error);
    res.status(500).json({ message: "Failed to delete vendor customer" });
  }
});

// Vendor dashboard endpoint
router.get("/dashboard", requireTenant, async (req, res) => {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user is a vendor
    if (user.role !== 'vendor') {
      return res.status(403).json({ message: "Access denied. Vendor role required." });
    }

    // Get vendor-specific data
    const vendorEmail = user.email;
    
    // Get real employee data from database
    const employees = await storage.getEmployees(tenant.id);
    
    // Calculate employee statistics
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(emp => emp.status === 'active').length;
    
    // Group employees by department
    const departmentCounts = employees.reduce((acc, emp) => {
      const dept = emp.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Convert to array format for frontend
    const departments = Object.entries(departmentCounts).map(([name, count]) => ({
      name,
      count
    }));
    
    // Calculate recent hires (employees hired in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentHires = employees.filter(emp => {
      if (!emp.joinDate) return false;
      return new Date(emp.joinDate) >= thirtyDaysAgo;
    }).length;

    // Get vendor orders from database
    const { db } = await import('../db');
    const { vendorOrders, products } = await import('@shared/schema');
    const { eq, gte, lte, sql, desc, count } = await import('drizzle-orm');

    // Calculate date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    // Get profit data for different periods
    const [dailyProfit] = await db
      .select({
        profit: sql<number>`COALESCE(SUM(${vendorOrders.profit}), 0)`,
        count: count()
      })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail),
          gte(vendorOrders.orderDate, today)
        )
      );

    const [weeklyProfit] = await db
      .select({
        profit: sql<number>`COALESCE(SUM(${vendorOrders.profit}), 0)`,
        count: count()
      })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail),
          gte(vendorOrders.orderDate, weekAgo)
        )
      );

    const [monthlyProfit] = await db
      .select({
        profit: sql<number>`COALESCE(SUM(${vendorOrders.profit}), 0)`,
        count: count()
      })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail),
          gte(vendorOrders.orderDate, monthAgo)
        )
      );

    const [yearlyProfit] = await db
      .select({
        profit: sql<number>`COALESCE(SUM(${vendorOrders.profit}), 0)`,
        count: count()
      })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail),
          gte(vendorOrders.orderDate, yearAgo)
        )
      );

    // Get order statistics
    const [todayOrders] = await db
      .select({ count: count() })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail),
          gte(vendorOrders.orderDate, today)
        )
      );

    const [weekOrders] = await db
      .select({ count: count() })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail),
          gte(vendorOrders.orderDate, weekAgo)
        )
      );

    const [monthOrders] = await db
      .select({ count: count() })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail),
          gte(vendorOrders.orderDate, monthAgo)
        )
      );

    // Get all vendor orders for status calculation
    const allVendorOrders = await db
      .select()
      .from(vendorOrders)
      .where(eq(vendorOrders.vendorEmail, vendorEmail))
      .orderBy(desc(vendorOrders.orderDate));

    // Calculate order status (simplified - all orders are considered completed)
    const completedOrders = allVendorOrders.length;
    const pendingOrders = 0; // You can add status field to vendor orders if needed
    const cancelledOrders = 0;

    // Get products data
    const allProducts = await storage.getProducts();
    const totalProducts = allProducts.length;

    // Get best selling products (top 5 by total sales)
    const bestSellers = await db
      .select({
        name: products.name,
        sales: sql<number>`COALESCE(SUM(${vendorOrders.quantity}), 0)`
      })
      .from(vendorOrders)
      .leftJoin(products, eq(vendorOrders.productId, products.id))
      .where(eq(vendorOrders.vendorEmail, vendorEmail))
      .groupBy(products.id, products.name)
      .orderBy(desc(sql`SUM(${vendorOrders.quantity})`))
      .limit(5);

    // Get recently updated products (mock data for now)
    const recentlyUpdated = allProducts.slice(0, 3).map(product => ({
      name: product.name,
      lastUpdated: new Date().toISOString().split('T')[0] // Mock date
    }));

    // Get vendor customers
    const vendorCustomers = await storage.getVendorCustomers(vendorEmail);
    const totalCustomers = vendorCustomers.length;

    // Calculate new customers this month
    const newCustomersThisMonth = vendorCustomers.filter(customer => {
      if (!customer.createdAt) return false;
      return new Date(customer.createdAt) >= monthAgo;
    }).length;

    // Calculate customer growth rate (simplified)
    const growthRate = totalCustomers > 0 ? ((newCustomersThisMonth / totalCustomers) * 100) : 0;

    // Calculate expenses (mock data for now - you can add payroll/expense tracking)
    const monthlyPayroll = totalEmployees * 3000; // Mock calculation
    const netProfitAfterExpenses = monthlyProfit.profit - monthlyPayroll;

    // Create profit vs expense data for chart
    const profitVsExpense = [
      { profit: monthlyProfit.profit, expense: monthlyPayroll },
      { profit: monthlyProfit.profit * 0.9, expense: monthlyPayroll * 0.95 },
      { profit: monthlyProfit.profit * 0.8, expense: monthlyPayroll * 0.9 }
    ];

    const dashboardData = {
      profit: {
        daily: { amount: dailyProfit.profit / 100, change: 0 }, // Convert cents to dollars
        weekly: { amount: weeklyProfit.profit / 100, change: 0 },
        monthly: { amount: monthlyProfit.profit / 100, change: 0 },
        yearly: { amount: yearlyProfit.profit / 100, change: 0 }
      },
      employees: {
        total: totalEmployees,
        active: activeEmployees,
        departments: departments,
        recentHires: recentHires
      },
      products: {
        total: totalProducts,
        bestSellers: bestSellers,
        recentlyUpdated: recentlyUpdated
      },
      orders: {
        today: todayOrders.count,
        thisWeek: weekOrders.count,
        thisMonth: monthOrders.count,
        status: { completed: completedOrders, pending: pendingOrders, cancelled: cancelledOrders }
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersThisMonth,
        growthRate: growthRate
      },
      expenses: {
        monthlyPayroll: monthlyPayroll,
        netProfitAfterExpenses: netProfitAfterExpenses / 100, // Convert cents to dollars
        profitVsExpense: profitVsExpense.map(item => ({
          profit: item.profit / 100, // Convert cents to dollars
          expense: item.expense
        }))
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error("Error fetching vendor dashboard data:", error);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

export default router; 