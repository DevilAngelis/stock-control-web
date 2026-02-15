import type { Express } from "express";
import { db } from "./db";
import { categories, products, movements } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<void> {
  // Categories
  app.get("/api/categories", async (_req, res) => {
    try {
      const allCategories = await db.select().from(categories);
      res.json(allCategories);
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
      res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const [category] = await db.insert(categories).values(req.body).returning();
      res.json(category);
    } catch (error) {
      console.error("Erro ao criar categoria:", error);
      res.status(500).json({ message: "Erro ao criar categoria" });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const [category] = await db
        .update(categories)
        .set(req.body)
        .where(eq(categories.id, req.params.id))
        .returning();
      res.json(category);
    } catch (error) {
      console.error("Erro ao atualizar categoria:", error);
      res.status(500).json({ message: "Erro ao atualizar categoria" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      await db.delete(categories).where(eq(categories.id, req.params.id));
      res.sendStatus(204);
    } catch (error) {
      console.error("Erro ao excluir categoria:", error);
      res.status(500).json({ message: "Erro ao excluir categoria" });
    }
  });

  // Products
  app.get("/api/products", async (_req, res) => {
    try {
      const allProducts = await db.select().from(products);
      res.json(allProducts);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      res.status(500).json({ message: "Erro ao buscar produtos" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const [product] = await db.insert(products).values(req.body).returning();
      res.json(product);
    } catch (error) {
      console.error("Erro ao criar produto:", error);
      res.status(500).json({ message: "Erro ao criar produto" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const [product] = await db
        .update(products)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(products.id, req.params.id))
        .returning();
      res.json(product);
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      res.status(500).json({ message: "Erro ao atualizar produto" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      await db.delete(movements).where(eq(movements.productId, req.params.id));
      await db.delete(products).where(eq(products.id, req.params.id));
      res.sendStatus(204);
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      res.status(500).json({ message: "Erro ao excluir produto" });
    }
  });

  // Movements
  app.get("/api/movements", async (_req, res) => {
    try {
      const allMovements = await db.select().from(movements).orderBy(desc(movements.createdAt));
      res.json(allMovements);
    } catch (error) {
      console.error("Erro ao buscar movimentações:", error);
      res.status(500).json({ message: "Erro ao buscar movimentações" });
    }
  });

  app.post("/api/movements", async (req, res) => {
    try {
      const { productId, type, quantity, note, id } = req.body;
      
      const [movement] = await db.insert(movements).values({
        id,
        productId,
        type,
        quantity,
        note,
      }).returning();

      // Update product quantity
      const [product] = await db.select().from(products).where(eq(products.id, productId));
      if (product) {
        let newQuantity = product.quantity;
        if (type === "entry") {
          newQuantity += quantity;
        } else {
          newQuantity = Math.max(0, newQuantity - quantity);
        }
        await db.update(products)
          .set({ quantity: newQuantity, updatedAt: new Date() })
          .where(eq(products.id, productId));
      }

      res.json(movement);
    } catch (error) {
      console.error("Erro ao criar movimentação:", error);
      res.status(500).json({ message: "Erro ao criar movimentação" });
    }
  });
}
