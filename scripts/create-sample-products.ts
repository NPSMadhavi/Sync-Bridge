import { db } from '../server/db.js';
import { products } from '../shared/schema.js';

// Sample products with categories
const sampleProducts = [
  // DOUGH category
  { name: "Whole Wheat Dough", description: "Healthy whole wheat pizza dough", category: "DOUGH", tenantId: 1 },
  { name: "Gluten-Free Dough", description: "Gluten-free pizza dough for dietary restrictions", category: "DOUGH", tenantId: 1 },
  { name: "Sourdough Pizza Dough", description: "Traditional sourdough pizza dough", category: "DOUGH", tenantId: 1 },
  
  // SAUCES category
  { name: "Marinara Sauce", description: "Classic tomato marinara sauce", category: "SAUCES", tenantId: 1 },
  { name: "Pesto Sauce", description: "Fresh basil pesto sauce", category: "SAUCES", tenantId: 1 },
  { name: "BBQ Sauce", description: "Sweet and tangy BBQ sauce", category: "SAUCES", tenantId: 1 },
  { name: "Alfredo Sauce", description: "Creamy alfredo sauce", category: "SAUCES", tenantId: 1 },
  
  // TOPPINGS category
  { name: "Mozzarella Cheese", description: "Fresh mozzarella cheese", category: "TOPPINGS", tenantId: 1 },
  { name: "Pepperoni", description: "Classic pepperoni slices", category: "TOPPINGS", tenantId: 1 },
  { name: "Mushrooms", description: "Fresh sliced mushrooms", category: "TOPPINGS", tenantId: 1 },
  { name: "Bell Peppers", description: "Colorful bell peppers", category: "TOPPINGS", tenantId: 1 },
  { name: "Onions", description: "Fresh onions", category: "TOPPINGS", tenantId: 1 },
  
  // BEVERAGES category
  { name: "Soft Drinks", description: "Assorted soft drinks", category: "BEVERAGES", tenantId: 1 },
  { name: "Bottled Water", description: "Pure bottled water", category: "BEVERAGES", tenantId: 1 },
  { name: "Juice", description: "Fresh fruit juices", category: "BEVERAGES", tenantId: 1 },
  
  // SIDES category
  { name: "Garlic Bread", description: "Fresh garlic bread", category: "SIDES", tenantId: 1 },
  { name: "Caesar Salad", description: "Fresh caesar salad", category: "SIDES", tenantId: 1 },
  { name: "Wings", description: "Chicken wings with sauce", category: "SIDES", tenantId: 1 },
];

async function createSampleProducts() {
  try {
    console.log('Creating sample products...');
    
    for (const product of sampleProducts) {
      await db.insert(products).values(product);
      console.log(`Created product: ${product.name} (${product.category})`);
    }
    
    console.log('Sample products created successfully!');
  } catch (error) {
    console.error('Error creating sample products:', error);
  } finally {
    process.exit(0);
  }
}

createSampleProducts(); 