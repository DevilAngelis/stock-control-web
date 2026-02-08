import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Colors from "@/constants/colors";
import { getProducts, getCategories, Product, Category } from "@/lib/storage";

function AlertCard({ product, category }: { product: Product; category?: Category }) {
  const percentage = product.minStock > 0 ? Math.min((product.quantity / product.minStock) * 100, 100) : 0;
  const isZero = product.quantity === 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.alertCard, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
    >
      <View style={styles.alertTop}>
        <View style={styles.alertLeft}>
          <View style={[styles.statusDot, { backgroundColor: isZero ? Colors.danger : Colors.warning }]} />
          <View>
            <Text style={styles.alertName} numberOfLines={1}>{product.name}</Text>
            <Text style={styles.alertCat}>{category?.name ?? "Sem categoria"}</Text>
          </View>
        </View>
        <View style={styles.alertRight}>
          <Text style={[styles.alertQty, { color: isZero ? Colors.danger : Colors.warning }]}>
            {product.quantity}
          </Text>
          <Text style={styles.alertUnit}>/ {product.minStock} {product.unit}</Text>
        </View>
      </View>
      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${percentage}%` as any,
              backgroundColor: isZero ? Colors.danger : percentage <= 50 ? Colors.warning : Colors.accent,
            },
          ]}
        />
      </View>
      <View style={styles.alertBottom}>
        <Text style={styles.alertLabel}>
          {isZero ? "Sem estoque" : `${Math.round(percentage)}% do mínimo`}
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: "/movement/add", params: { productId: product.id, type: "entry" } })}
          style={({ pressed }) => [styles.restockBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="add-circle" size={16} color={Colors.primary} />
          <Text style={styles.restockText}>Repor</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [p, c] = await Promise.all([getProducts(), getCategories()]);
    setProducts(p);
    setCategories(c);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const lowStock = products
    .filter((p) => p.quantity <= p.minStock)
    .sort((a, b) => a.quantity - b.quantity);

  const outOfStock = lowStock.filter((p) => p.quantity === 0);
  const critical = lowStock.filter((p) => p.quantity > 0);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={styles.title}>Alertas</Text>
        <Text style={styles.subtitle}>
          {lowStock.length === 0
            ? "Todos os produtos estão em dia"
            : `${lowStock.length} ${lowStock.length === 1 ? "produto precisa" : "produtos precisam"} de atenção`}
        </Text>
      </View>

      {lowStock.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
          </View>
          <Text style={styles.emptyTitle}>Tudo certo!</Text>
          <Text style={styles.emptyText}>Nenhum produto com estoque baixo</Text>
        </View>
      ) : (
        <FlatList
          data={lowStock}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AlertCard product={item} category={categories.find((c) => c.id === item.categoryId)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: Colors.dangerLight }]}>
                <Ionicons name="close-circle" size={20} color={Colors.danger} />
                <Text style={[styles.summaryValue, { color: Colors.danger }]}>{outOfStock.length}</Text>
                <Text style={styles.summaryLabel}>Sem estoque</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: Colors.warningLight }]}>
                <Ionicons name="warning" size={20} color={Colors.warning} />
                <Text style={[styles.summaryValue, { color: Colors.warning }]}>{critical.length}</Text>
                <Text style={styles.summaryLabel}>Estoque baixo</Text>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "web" ? 34 : 100,
  },
  alertCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  alertTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  alertLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  alertName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  alertCat: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 1,
  },
  alertRight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  alertQty: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  alertUnit: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  progressBg: {
    height: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  alertBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alertLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  restockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  restockText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
});
