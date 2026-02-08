import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  quantity: number;
  minStock: number;
  price: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface Movement {
  id: string;
  productId: string;
  type: "entry" | "exit";
  quantity: number;
  note: string;
  createdAt: string;
}

const KEYS = {
  PRODUCTS: "inventory_products",
  CATEGORIES: "inventory_categories",
  MOVEMENTS: "inventory_movements",
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat_1", name: "Eletrônicos", color: "#3B82F6" },
  { id: "cat_2", name: "Alimentos", color: "#10B981" },
  { id: "cat_3", name: "Bebidas", color: "#8B5CF6" },
  { id: "cat_4", name: "Limpeza", color: "#F59E0B" },
  { id: "cat_5", name: "Escritório", color: "#EF4444" },
  { id: "cat_6", name: "Outros", color: "#64748B" },
];

async function initCategories(): Promise<Category[]> {
  const raw = await AsyncStorage.getItem(KEYS.CATEGORIES);
  if (!raw) {
    await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  }
  return JSON.parse(raw);
}

export async function getCategories(): Promise<Category[]> {
  return initCategories();
}

export async function addCategory(name: string, color: string): Promise<Category> {
  const categories = await getCategories();
  const cat: Category = { id: Crypto.randomUUID(), name, color };
  categories.push(cat);
  await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
  return cat;
}

export async function deleteCategory(id: string): Promise<void> {
  const categories = await getCategories();
  const filtered = categories.filter((c) => c.id !== id);
  await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(filtered));
}

export async function getProducts(): Promise<Product[]> {
  const raw = await AsyncStorage.getItem(KEYS.PRODUCTS);
  return raw ? JSON.parse(raw) : [];
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((p) => p.id === id);
}

export async function addProduct(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
  const products = await getProducts();
  const now = new Date().toISOString();
  const product: Product = {
    ...data,
    id: Crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  products.push(product);
  await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  return product;
}

export async function updateProduct(id: string, data: Partial<Omit<Product, "id" | "createdAt">>): Promise<Product | undefined> {
  const products = await getProducts();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return undefined;
  products[index] = { ...products[index], ...data, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  return products[index];
}

export async function deleteProduct(id: string): Promise<void> {
  const products = await getProducts();
  const filtered = products.filter((p) => p.id !== id);
  await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(filtered));
  const movements = await getMovements();
  const filteredMovements = movements.filter((m) => m.productId !== id);
  await AsyncStorage.setItem(KEYS.MOVEMENTS, JSON.stringify(filteredMovements));
}

export async function getMovements(): Promise<Movement[]> {
  const raw = await AsyncStorage.getItem(KEYS.MOVEMENTS);
  return raw ? JSON.parse(raw) : [];
}

export async function addMovement(data: Omit<Movement, "id" | "createdAt">): Promise<Movement> {
  const movements = await getMovements();
  const movement: Movement = {
    ...data,
    id: Crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  movements.push(movement);
  await AsyncStorage.setItem(KEYS.MOVEMENTS, JSON.stringify(movements));

  const products = await getProducts();
  const index = products.findIndex((p) => p.id === data.productId);
  if (index !== -1) {
    if (data.type === "entry") {
      products[index].quantity += data.quantity;
    } else {
      products[index].quantity = Math.max(0, products[index].quantity - data.quantity);
    }
    products[index].updatedAt = new Date().toISOString();
    await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  }

  return movement;
}
