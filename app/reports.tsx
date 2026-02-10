import React, { useCallback, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Colors from "@/constants/colors";
import {
  getProducts,
  getCategories,
  getMovements,
  Product,
  Category,
  Movement,
} from "@/lib/storage";

type Period = "7d" | "30d" | "90d" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  all: "Tudo",
};

function filterByPeriod(movements: Movement[], period: Period): Movement[] {
  if (period === "all") return movements;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return movements.filter((m) => new Date(m.createdAt) >= cutoff);
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function SummaryCard({
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
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.summaryInfo}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
        {sub ? <Text style={styles.summarySub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function BarRow({ label, value, maxValue, color }: { label: string; value: number; maxValue: number; color: string }) {
  const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 4;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${width}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [period, setPeriod] = useState<Period>("30d");

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [p, c, m] = await Promise.all([getProducts(), getCategories(), getMovements()]);
        setProducts(p);
        setCategories(c);
        setMovements(m.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      })();
    }, [])
  );

  const filtered = useMemo(() => filterByPeriod(movements, period), [movements, period]);

  const entries = filtered.filter((m) => m.type === "entry");
  const exits = filtered.filter((m) => m.type === "exit");
  const totalEntryQty = entries.reduce((a, m) => a + m.quantity, 0);
  const totalExitQty = exits.reduce((a, m) => a + m.quantity, 0);

  const entryValue = entries.reduce((acc, m) => {
    const prod = products.find((p) => p.id === m.productId);
    return acc + m.quantity * (prod?.price ?? 0);
  }, 0);
  const exitValue = exits.reduce((acc, m) => {
    const prod = products.find((p) => p.id === m.productId);
    return acc + m.quantity * (prod?.price ?? 0);
  }, 0);

  const topEntryProducts = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((m) => { map[m.productId] = (map[m.productId] ?? 0) + m.quantity; });
    return Object.entries(map)
      .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
      .filter((x) => x.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [entries, products]);

  const topExitProducts = useMemo(() => {
    const map: Record<string, number> = {};
    exits.forEach((m) => { map[m.productId] = (map[m.productId] ?? 0) + m.quantity; });
    return Object.entries(map)
      .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
      .filter((x) => x.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [exits, products]);

  const categoryBreakdown = useMemo(() => {
    return categories.map((cat) => {
      const catProducts = products.filter((p) => p.categoryId === cat.id);
      const totalQty = catProducts.reduce((a, p) => a + p.quantity, 0);
      const totalVal = catProducts.reduce((a, p) => a + p.quantity * p.price, 0);
      return { category: cat, productCount: catProducts.length, totalQty, totalVal };
    }).filter((c) => c.productCount > 0).sort((a, b) => b.totalVal - a.totalVal);
  }, [categories, products]);

  const lowStockProducts = products.filter((p) => p.quantity <= p.minStock);
  const zeroStockProducts = products.filter((p) => p.quantity === 0);
  const totalStockValue = products.reduce((a, p) => a + p.quantity * p.price, 0);
  const avgPrice = products.length > 0 ? products.reduce((a, p) => a + p.price, 0) / products.length : 0;

  const topMaxEntry = topEntryProducts.length > 0 ? topEntryProducts[0].qty : 1;
  const topMaxExit = topExitProducts.length > 0 ? topExitProducts[0].qty : 1;
  const maxCatVal = categoryBreakdown.length > 0 ? categoryBreakdown[0].totalVal : 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.periodRow}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Resumo de Movimentações</Text>
      <View style={styles.summaryGrid}>
        <SummaryCard
          icon="arrow-down"
          iconColor={Colors.success}
          iconBg={Colors.successLight}
          label="Entradas"
          value={totalEntryQty.toString()}
          sub={formatCurrency(entryValue)}
        />
        <SummaryCard
          icon="arrow-up"
          iconColor={Colors.danger}
          iconBg={Colors.dangerLight}
          label="Saídas"
          value={totalExitQty.toString()}
          sub={formatCurrency(exitValue)}
        />
        <SummaryCard
          icon="swap-horizontal"
          iconColor="#3B82F6"
          iconBg="#DBEAFE"
          label="Total Movim."
          value={filtered.length.toString()}
          sub={`${entries.length} ent. / ${exits.length} saí.`}
        />
        <SummaryCard
          icon="trending-up"
          iconColor={Colors.primary}
          iconBg="#E0F2F1"
          label="Saldo Líquido"
          value={(totalEntryQty - totalExitQty >= 0 ? "+" : "") + (totalEntryQty - totalExitQty).toString()}
          sub={formatCurrency(entryValue - exitValue)}
        />
      </View>

      {topEntryProducts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Mais Entradas</Text>
          <View style={styles.chartCard}>
            {topEntryProducts.map((item) => (
              <BarRow
                key={item.product!.id}
                label={item.product!.name}
                value={item.qty}
                maxValue={topMaxEntry}
                color={Colors.success}
              />
            ))}
          </View>
        </>
      )}

      {topExitProducts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Mais Saídas</Text>
          <View style={styles.chartCard}>
            {topExitProducts.map((item) => (
              <BarRow
                key={item.product!.id}
                label={item.product!.name}
                value={item.qty}
                maxValue={topMaxExit}
                color={Colors.danger}
              />
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Visão Geral do Estoque</Text>
      <View style={styles.overviewCard}>
        <View style={styles.overviewRow}>
          <Text style={styles.overviewLabel}>Valor total em estoque</Text>
          <Text style={styles.overviewValue}>{formatCurrency(totalStockValue)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.overviewRow}>
          <Text style={styles.overviewLabel}>Total de produtos</Text>
          <Text style={styles.overviewValue}>{products.length}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.overviewRow}>
          <Text style={styles.overviewLabel}>Preço médio</Text>
          <Text style={styles.overviewValue}>{formatCurrency(avgPrice)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.overviewRow}>
          <Text style={styles.overviewLabel}>Estoque baixo</Text>
          <Text style={[styles.overviewValue, lowStockProducts.length > 0 && { color: Colors.warning }]}>
            {lowStockProducts.length}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.overviewRow}>
          <Text style={styles.overviewLabel}>Sem estoque</Text>
          <Text style={[styles.overviewValue, zeroStockProducts.length > 0 && { color: Colors.danger }]}>
            {zeroStockProducts.length}
          </Text>
        </View>
      </View>

      {categoryBreakdown.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Valor por Categoria</Text>
          <View style={styles.chartCard}>
            {categoryBreakdown.map((item) => (
              <BarRow
                key={item.category.id}
                label={item.category.name}
                value={Math.round(item.totalVal)}
                maxValue={maxCatVal}
                color={item.category.color}
              />
            ))}
          </View>
        </>
      )}

      {filtered.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Sem dados no período</Text>
          <Text style={styles.emptyText}>Registre movimentações para ver os relatórios</Text>
        </View>
      )}

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
  periodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  periodBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  periodText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  periodTextActive: {
    color: Colors.white,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  summaryCard: {
    width: "48.5%" as any,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 2,
  },
  summarySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  barLabel: {
    width: 80,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  barTrack: {
    flex: 1,
    height: 22,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 6,
    minWidth: 4,
  },
  barValue: {
    width: 50,
    textAlign: "right" as const,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  overviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  overviewLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  overviewValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
});
