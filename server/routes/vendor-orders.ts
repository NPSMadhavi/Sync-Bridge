import { Router } from 'express';
import { db } from '../db';
import { vendorOrders, products, vendorProductPrices, users } from '../../shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { requireTenant } from '../middleware/tenant';

const router = Router();

// Create a new vendor order
router.post('/', requireTenant, async (req, res) => {
  try {
    const { vendorEmail, productId, customerName, quantity, buyingPrice, sellingPrice, orderDate } = req.body;
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user belongs to the tenant (unless super admin)
    if (user?.role !== 'super_admin' && !user?.isSuperAdmin && user?.tenantId !== tenant?.id) {
      return res.status(403).json({ message: "Access denied: User does not belong to this tenant" });
    }
    
    // For vendors, ensure they can only create orders for themselves
    if (user?.role === 'vendor' && user?.email !== vendorEmail) {
      return res.status(403).json({ message: "Access denied: Vendors can only create orders for themselves" });
    }
    
    if (
      !vendorEmail || !productId || !customerName || !quantity || !buyingPrice || !sellingPrice || !orderDate
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Use exact decimal values and calculate totals and profit
    const totalCost = Math.round(buyingPrice * quantity * 100); // Convert to cents for storage
    const totalSale = Math.round(sellingPrice * quantity * 100); // Convert to cents for storage
    const profit = totalSale - totalCost;

    const orderData = {
      vendorEmail,
      productId,
      customerName,
      quantity,
      buyingPrice: Math.round(buyingPrice * 100), // Convert to cents for storage
      sellingPrice: Math.round(sellingPrice * 100), // Convert to cents for storage
      orderDate: new Date(orderDate),
      totalCost,
      totalSale,
      profit,
    };

    const [newOrder] = await db.insert(vendorOrders).values(orderData).returning();
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating vendor order:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Get vendor orders with optional filters
router.get('/', requireTenant, async (req, res) => {
  try {
    const { vendorEmail, dateFrom, dateTo, productId, customerName } = req.query;
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user belongs to the tenant (unless super admin)
    if (user?.role !== 'super_admin' && !user?.isSuperAdmin && user?.tenantId !== tenant?.id) {
      return res.status(403).json({ message: "Access denied: User does not belong to this tenant" });
    }
    
    if (!vendorEmail) {
      return res.status(400).json({ message: 'Vendor email is required' });
    }
    
    // For vendors, ensure they can only access their own orders
    if (user?.role === 'vendor' && user?.email !== vendorEmail) {
      return res.status(403).json({ message: "Access denied: Vendors can only access their own orders" });
    }

    let whereConditions = [eq(vendorOrders.vendorEmail, vendorEmail as string)];

    if (dateFrom) {
      // Parse date and set to start of day (00:00:00) to include all orders from that day
      const dateFromObj = new Date(dateFrom as string);
      dateFromObj.setHours(0, 0, 0, 0);
      whereConditions.push(gte(vendorOrders.orderDate, dateFromObj));
    }

    if (dateTo) {
      // Parse date and set to end of day (23:59:59.999) to include all orders from that day
      const dateToObj = new Date(dateTo as string);
      dateToObj.setHours(23, 59, 59, 999);
      whereConditions.push(lte(vendorOrders.orderDate, dateToObj));
    }

    if (productId && productId !== 'all') {
      whereConditions.push(eq(vendorOrders.productId, parseInt(productId as string)));
    }

    if (customerName) {
      whereConditions.push(sql`LOWER(${vendorOrders.customerName}) LIKE LOWER(${'%' + customerName + '%'})`);
    }

    const orders = await db
      .select({
        id: vendorOrders.id,
        vendorEmail: vendorOrders.vendorEmail,
        customerName: vendorOrders.customerName,
        productId: vendorOrders.productId,
        quantity: vendorOrders.quantity,
        buyingPrice: vendorOrders.buyingPrice,
        sellingPrice: vendorOrders.sellingPrice,
        totalCost: vendorOrders.totalCost,
        totalSale: vendorOrders.totalSale,
        profit: vendorOrders.profit,
        orderDate: vendorOrders.orderDate,
        createdAt: vendorOrders.createdAt,
        product: {
          id: products.id,
          name: products.name,
          description: products.description,
          category: products.category,
        }
      })
      .from(vendorOrders)
      .leftJoin(products, eq(vendorOrders.productId, products.id))
      .where(and(...whereConditions))
      .orderBy(sql`${vendorOrders.orderDate} DESC`);

    res.json(orders);
  } catch (error) {
    console.error('Error fetching vendor orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Get vendor profit statistics
router.get('/stats', requireTenant, async (req, res) => {
  try {
    const { vendorEmail } = req.query;
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user belongs to the tenant (unless super admin)
    if (user?.role !== 'super_admin' && !user?.isSuperAdmin && user?.tenantId !== tenant?.id) {
      return res.status(403).json({ message: "Access denied: User does not belong to this tenant" });
    }
    
    if (!vendorEmail) {
      return res.status(400).json({ message: 'Vendor email is required' });
    }
    
    // For vendors, ensure they can only access their own stats
    if (user?.role === 'vendor' && user?.email !== vendorEmail) {
      return res.status(403).json({ message: "Access denied: Vendors can only access their own statistics" });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate(), 0, 0, 0, 0);
    const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate(), 0, 0, 0, 0);

    // Today's stats
    const todayStats = await db
      .select({
        profit: sql<number>`COALESCE(SUM(${vendorOrders.profit}), 0)`,
        orders: sql<number>`COUNT(*)`,
        averageProfit: sql<number>`COALESCE(AVG(${vendorOrders.profit}), 0)`
      })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail as string),
          gte(vendorOrders.orderDate, today)
        )
      );

    // Weekly stats
    const weekStats = await db
      .select({
        profit: sql<number>`COALESCE(SUM(${vendorOrders.profit}), 0)`,
        orders: sql<number>`COUNT(*)`,
        averageProfit: sql<number>`COALESCE(AVG(${vendorOrders.profit}), 0)`
      })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail as string),
          gte(vendorOrders.orderDate, weekAgo)
        )
      );

    // Monthly stats
    const monthStats = await db
      .select({
        profit: sql<number>`COALESCE(SUM(${vendorOrders.profit}), 0)`,
        orders: sql<number>`COUNT(*)`,
        averageProfit: sql<number>`COALESCE(AVG(${vendorOrders.profit}), 0)`
      })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail as string),
          gte(vendorOrders.orderDate, monthAgo)
        )
      );

    // Yearly stats
    const yearStats = await db
      .select({
        profit: sql<number>`COALESCE(SUM(${vendorOrders.profit}), 0)`,
        orders: sql<number>`COUNT(*)`,
        averageProfit: sql<number>`COALESCE(AVG(${vendorOrders.profit}), 0)`
      })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail as string),
          gte(vendorOrders.orderDate, yearAgo)
        )
      );

    res.json({
      today: todayStats[0] || { profit: 0, orders: 0, averageProfit: 0 },
      week: weekStats[0] || { profit: 0, orders: 0, averageProfit: 0 },
      month: monthStats[0] || { profit: 0, orders: 0, averageProfit: 0 },
      year: yearStats[0] || { profit: 0, orders: 0, averageProfit: 0 }
    });
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// Update vendor order
router.put('/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { vendorEmail, productId, customerName, quantity, buyingPrice, sellingPrice, orderDate } = req.body;
    
    if (!vendorEmail) {
      return res.status(400).json({ message: 'Vendor email is required' });
    }

    // Use exact decimal values and calculate totals and profit
    const totalCost = Math.round(buyingPrice * quantity * 100); // Convert to cents for storage
    const totalSale = Math.round(sellingPrice * quantity * 100); // Convert to cents for storage
    const profit = totalSale - totalCost;

    const updateData = {
      vendorEmail,
      productId,
      customerName,
      quantity,
      buyingPrice: Math.round(buyingPrice * 100), // Convert to cents for storage
      sellingPrice: Math.round(sellingPrice * 100), // Convert to cents for storage
      orderDate: new Date(orderDate),
      totalCost,
      totalSale,
      profit,
    };

    const [updatedOrder] = await db
      .update(vendorOrders)
      .set(updateData)
      .where(eq(vendorOrders.id, orderId))
      .returning();

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating vendor order:', error);
    res.status(500).json({ message: 'Failed to update order' });
  }
});

// Delete vendor order
router.delete('/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    const [deletedOrder] = await db
      .delete(vendorOrders)
      .where(eq(vendorOrders.id, orderId))
      .returning();

    if (!deletedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting vendor order:', error);
    res.status(500).json({ message: 'Failed to delete order' });
  }
});

// Generate vendor order report as CSV
router.get('/report', requireTenant, async (req, res) => {
  try {
    const { vendorEmail, range } = req.query;
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    
    // Ensure user belongs to the tenant (unless super admin)
    if (user?.role !== 'super_admin' && !user?.isSuperAdmin && user?.tenantId !== tenant?.id) {
      return res.status(403).json({ message: "Access denied: User does not belong to this tenant" });
    }
    
    if (!vendorEmail) {
      return res.status(400).json({ message: 'Vendor email is required' });
    }
    
    // For vendors, ensure they can only access their own reports
    if (user?.role === 'vendor' && user?.email !== vendorEmail) {
      return res.status(403).json({ message: "Access denied: Vendors can only access their own reports" });
    }

    if (!range || !['daily', 'weekly', 'monthly', 'yearly'].includes(range as string)) {
      return res.status(400).json({ message: 'Valid range is required (daily, weekly, monthly, yearly)' });
    }

    const now = new Date();
    let startDate: Date;

    switch (range) {
      case 'daily':
        // Go back to start of today to include all orders from today
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        startDate = startOfToday;
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        // Get start of current day, then go back one month
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0);
        startDate = monthAgo;
        break;
      case 'yearly':
        // Get start of current day, then go back one year
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
        startDate = yearAgo;
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to weekly
    }

    const orders = await db
      .select({
        orderDate: vendorOrders.orderDate,
        productName: products.name,
        customerName: vendorOrders.customerName,
        quantity: vendorOrders.quantity,
        buyingPrice: vendorOrders.buyingPrice,
        sellingPrice: vendorOrders.sellingPrice,
        totalCost: vendorOrders.totalCost,
        totalSale: vendorOrders.totalSale,
        profit: vendorOrders.profit,
      })
      .from(vendorOrders)
      .leftJoin(products, eq(vendorOrders.productId, products.id))
      .where(
        and(
          eq(vendorOrders.vendorEmail, vendorEmail as string),
          gte(vendorOrders.orderDate, startDate)
        )
      )
      .orderBy(sql`${vendorOrders.orderDate} DESC`);

    // Generate CSV content
    const csvHeaders = [
      'Order Date',
      'Product Name',
      'Customer Name',
      'Quantity',
      'Buying Price ($)',
      'Selling Price ($)',
      'Total Cost ($)',
      'Total Sale ($)',
      'Profit ($)'
    ];

    const csvRows = orders.map((order: any) => [
      new Date(order.orderDate).toLocaleDateString(),
      order.productName || 'Unknown Product',
      order.customerName,
      order.quantity,
      (order.buyingPrice / 100).toFixed(2),
      (order.sellingPrice / 100).toFixed(2),
      (order.totalCost / 100).toFixed(2),
      (order.totalSale / 100).toFixed(2),
      (order.profit / 100).toFixed(2)
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row: any) => row.join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vendor_report_${range}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error generating vendor report:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
});

export default router; 