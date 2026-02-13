import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Colors from "@/constants/colors";
import { getProducts, getCategories, getMovements, Product, Category, Movement } from "@/lib/storage";

function StatCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function RecentMovementRow({
  movement,
  products,
}: {
  movement: Movement;
  products: Product[];
}) {
  const product = products.find((p) => p.id === movement.productId);
  const isEntry = movement.type === "entry";
  const date = new Date(movement.createdAt);
  const formatted = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return (
    <View style={styles.movRow}>
      <View style={[styles.movIcon, { backgroundColor: isEntry ? Colors.successLight : Colors.dangerLight }]}>
        <Ionicons
          name={isEntry ? "arrow-down" : "arrow-up"}
          size={16}
          color={isEntry ? Colors.success : Colors.danger}
        />
      </View>
      <View style={styles.movInfo}>
        <Text style={styles.movProduct} numberOfLines={1}>
          {product?.name ?? "Produto removido"}
        </Text>
        <Text style={styles.movDate}>{formatted}</Text>
      </View>
      <Text style={[styles.movQty, { color: isEntry ? Colors.success : Colors.danger }]}>
        {isEntry ? "+" : "-"}{movement.quantity}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [p, c, m] = await Promise.all([getProducts(), getCategories(), getMovements()]);
    setProducts(p);
    setCategories(c);
    setMovements(m.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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

  const totalProducts = products.length;
  const totalItems = products.reduce((acc, p) => acc + p.quantity, 0);
  const totalValue = products.reduce((acc, p) => acc + p.quantity * p.price, 0);
  const lowStock = products.filter((p) => p.quantity <= p.minStock);
  const recentMovements = movements.slice(0, 5);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding + 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.companyName}>MTEC ENERGIA</Text>
        <Text style={styles.greeting}>Controle de Estoque</Text>
        <Text style={styles.subGreeting}>Visão geral do seu inventário</Text>

        <View style={styles.statsGrid}>
          <StatCard
            icon="cube-outline"
            iconColor={Colors.primary}
            iconBg="#E0F2F1"
            label="Produtos"
            value={totalProducts.toString()}
          />
          <StatCard
            icon="layers-outline"
            iconColor="#3B82F6"
            iconBg="#DBEAFE"
            label="Itens Total"
            value={totalItems.toString()}
          />
          <StatCard
            icon="cash-outline"
            iconColor={Colors.success}
            iconBg={Colors.successLight}
            label="Valor Estoque"
            value={`R$ ${totalValue.toFixed(2).replace(".", ",")}`}
          />
          <StatCard
            icon="warning-outline"
            iconColor={Colors.danger}
            iconBg={Colors.dangerLight}
            label="Estoque Baixo"
            value={lowStock.length.toString()}
          />
        </View>

        {lowStock.length > 0 && (
          <View style={styles.alertBanner}>
            <View style={styles.alertBannerLeft}>
              <Ionicons name="alert-circle" size={20} color={Colors.danger} />
              <Text style={styles.alertBannerText}>
                {lowStock.length} {lowStock.length === 1 ? "produto" : "produtos"} com estoque baixo
              </Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Movimentações Recentes</Text>
        </View>

        {recentMovements.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="swap-horizontal" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Nenhuma movimentação registrada</Text>
          </View>
        ) : (
          <View style={styles.movList}>
            {recentMovements.map((m) => (
              <RecentMovementRow key={m.id} movement={m} products={products} />
            ))}
          </View>
        )}

        <View style={styles.quickActions}>
          <Pressable
            onPress={() => router.push("/reports")}
            style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.quickIcon, { backgroundColor: "#EDE9FE" }]}>
              <Ionicons name="bar-chart-outline" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.quickLabel}>Relatórios</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/backup")}
            style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.quickIcon, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="cloud-download-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.quickLabel}>Backup & Dados</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categorias</Text>
          <Pressable
            onPress={() => router.push("/categories")}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.manageLink}>Gerenciar</Text>
          </Pressable>
        </View>
        <View style={styles.catGrid}>
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <View key={cat.id} style={styles.catCard}>
                <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catCount}>{count}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  companyName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: "47.5%" as any,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  statSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  alertBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertBannerText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.danger,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  manageLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  quickActions: {
    gap: 10,
    marginBottom: 20,
  },
  quickCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  movList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
    marginBottom: 20,
  },
  movRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  movIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  movInfo: {
    flex: 1,
  },
  movProduct: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  movDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  movQty: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  catCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 8,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  catCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
});
