import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getProduct, getCategories, getMovements, deleteProduct, Product, Category, Movement } from "@/lib/storage";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);

  const loadData = useCallback(async () => {
    if (!id) return;
    const p = await getProduct(id);
    if (!p) return;
    setProduct(p);
    const cats = await getCategories();
    setCategory(cats.find((c) => c.id === p.categoryId) ?? null);
    const movs = await getMovements();
    setMovements(
      movs
        .filter((m) => m.productId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20)
    );
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = () => {
    Alert.alert("Excluir Produto", `Deseja realmente excluir "${product?.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          if (!id) return;
          await deleteProduct(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  };

  if (!product) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>Produto não encontrado</Text>
        </View>
      </View>
    );
  }

  const isLow = product.quantity <= product.minStock;
  const percentage = product.minStock > 0 ? Math.min((product.quantity / product.minStock) * 100, 100) : (product.quantity > 0 ? 100 : 0);
  const totalValue = product.quantity * product.price;
  const created = new Date(product.createdAt);
  const updated = new Date(product.updatedAt);
  const formatDate = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={[styles.catBadge, { backgroundColor: category?.color ?? Colors.textTertiary }]}>
            <Text style={styles.catBadgeText}>{category?.name ?? "Sem categoria"}</Text>
          </View>
          {isLow && (
            <View style={styles.lowBadge}>
              <Ionicons name="warning" size={12} color={Colors.danger} />
              <Text style={styles.lowBadgeText}>Estoque Baixo</Text>
            </View>
          )}
        </View>
        <Text style={styles.productName}>{product.name}</Text>

        <View style={styles.qtyRow}>
          <View style={styles.qtyBlock}>
            <Text style={styles.qtyLabel}>Quantidade</Text>
            <Text style={[styles.qtyValue, isLow && { color: Colors.danger }]}>
              {product.quantity} <Text style={styles.qtyUnit}>{product.unit}</Text>
            </Text>
          </View>
          <View style={styles.qtyDivider} />
          <View style={styles.qtyBlock}>
            <Text style={styles.qtyLabel}>Mín. Estoque</Text>
            <Text style={styles.qtyValue}>
              {product.minStock} <Text style={styles.qtyUnit}>{product.unit}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${percentage}%` as any,
                backgroundColor: product.quantity === 0 ? Colors.danger : percentage <= 50 ? Colors.warning : Colors.success,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Ionicons name="cash-outline" size={20} color={Colors.primary} />
          <Text style={styles.infoLabel}>Preço Unit.</Text>
          <Text style={styles.infoValue}>R$ {product.price.toFixed(2).replace(".", ",")}</Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="wallet-outline" size={20} color={Colors.success} />
          <Text style={styles.infoLabel}>Valor Total</Text>
          <Text style={styles.infoValue}>R$ {totalValue.toFixed(2).replace(".", ",")}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: "/movement/add", params: { productId: product.id, type: "entry" } });
          }}
          style={({ pressed }) => [styles.actionBtn, styles.entryBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="arrow-down" size={18} color={Colors.success} />
          <Text style={[styles.actionBtnText, { color: Colors.success }]}>Entrada</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: "/movement/add", params: { productId: product.id, type: "exit" } });
          }}
          style={({ pressed }) => [styles.actionBtn, styles.exitBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="arrow-up" size={18} color={Colors.danger} />
          <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Saída</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: "/product/edit/[id]", params: { id: product.id } });
          }}
          style={({ pressed }) => [styles.actionBtn, styles.editBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="create-outline" size={18} color={Colors.primary} />
          <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Editar</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Histórico de Movimentações</Text>
      </View>

      {movements.length === 0 ? (
        <View style={styles.emptyMov}>
          <Ionicons name="swap-horizontal" size={32} color={Colors.textTertiary} />
          <Text style={styles.emptyMovText}>Nenhuma movimentação registrada</Text>
        </View>
      ) : (
        <View style={styles.movList}>
          {movements.map((m) => {
            const isEntry = m.type === "entry";
            const d = new Date(m.createdAt);
            const dateStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
            return (
              <View key={m.id} style={styles.movRow}>
                <View style={[styles.movIcon, { backgroundColor: isEntry ? Colors.successLight : Colors.dangerLight }]}>
                  <Ionicons name={isEntry ? "arrow-down" : "arrow-up"} size={14} color={isEntry ? Colors.success : Colors.danger} />
                </View>
                <View style={styles.movInfo}>
                  <Text style={styles.movNote}>{m.note || (isEntry ? "Entrada" : "Saída")}</Text>
                  <Text style={styles.movDate}>{dateStr}</Text>
                </View>
                <Text style={[styles.movQty, { color: isEntry ? Colors.success : Colors.danger }]}>
                  {isEntry ? "+" : "-"}{m.quantity}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.metaSection}>
        <Text style={styles.metaText}>Criado em: {formatDate(created)}</Text>
        <Text style={styles.metaText}>Atualizado em: {formatDate(updated)}</Text>
      </View>

      <Pressable
        onPress={handleDelete}
        style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.8 }]}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
        <Text style={styles.deleteBtnText}>Excluir Produto</Text>
      </Pressable>

      <View style={{ height: Platform.OS === "web" ? 34 : 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 12,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  catBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  catBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  lowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.dangerLight,
  },
  lowBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.danger,
  },
  productName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 16,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  qtyBlock: {
    flex: 1,
    alignItems: "center",
  },
  qtyLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  qtyValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  qtyUnit: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  qtyDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  progressBg: {
    height: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  infoValue: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  entryBtn: {
    backgroundColor: Colors.successLight,
    borderColor: "#A7F3D0",
  },
  exitBtn: {
    backgroundColor: Colors.dangerLight,
    borderColor: "#FECACA",
  },
  editBtn: {
    backgroundColor: "#E0F2F1",
    borderColor: "#B2DFDB",
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptyMov: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyMovText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  movList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
    marginBottom: 20,
  },
  movRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  movIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  movInfo: {
    flex: 1,
  },
  movNote: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  movDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 1,
  },
  movQty: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  metaSection: {
    paddingVertical: 12,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.danger,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
});
