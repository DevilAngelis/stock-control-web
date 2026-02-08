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
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getMovements, getProducts, Movement, Product } from "@/lib/storage";

function groupByDate(movements: Movement[]): { title: string; data: Movement[] }[] {
  const groups: Record<string, Movement[]> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const m of movements) {
    const d = new Date(m.createdAt);
    let key: string;
    if (d.toDateString() === today.toDateString()) {
      key = "Hoje";
    } else if (d.toDateString() === yesterday.toDateString()) {
      key = "Ontem";
    } else {
      key = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }

  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

function MovementItem({ movement, product }: { movement: Movement; product?: Product }) {
  const isEntry = movement.type === "entry";
  const date = new Date(movement.createdAt);
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  return (
    <View style={styles.movItem}>
      <View style={[styles.movIconWrap, { backgroundColor: isEntry ? Colors.successLight : Colors.dangerLight }]}>
        <Ionicons
          name={isEntry ? "arrow-down" : "arrow-up"}
          size={18}
          color={isEntry ? Colors.success : Colors.danger}
        />
      </View>
      <View style={styles.movContent}>
        <Text style={styles.movProduct} numberOfLines={1}>{product?.name ?? "Produto removido"}</Text>
        <Text style={styles.movNote} numberOfLines={1}>
          {movement.note || (isEntry ? "Entrada de estoque" : "Saída de estoque")}
        </Text>
      </View>
      <View style={styles.movRight}>
        <Text style={[styles.movQty, { color: isEntry ? Colors.success : Colors.danger }]}>
          {isEntry ? "+" : "-"}{movement.quantity}
        </Text>
        <Text style={styles.movTime}>{time}</Text>
      </View>
    </View>
  );
}

export default function MovementsScreen() {
  const insets = useSafeAreaInsets();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"all" | "entry" | "exit">("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [m, p] = await Promise.all([getMovements(), getProducts()]);
    setMovements(m.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setProducts(p);
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

  const filtered = filter === "all" ? movements : movements.filter((m) => m.type === filter);
  const grouped = groupByDate(filtered);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const renderItem = ({ item }: { item: Movement | { type: "header"; title: string } }) => {
    if ("title" in item && item.type === "header") {
      return <Text style={styles.dateHeader}>{item.title}</Text>;
    }
    const mov = item as Movement;
    return <MovementItem movement={mov} product={products.find((p) => p.id === mov.productId)} />;
  };

  const flatData: (Movement | { type: "header"; title: string; id: string })[] = [];
  for (const group of grouped) {
    flatData.push({ type: "header", title: group.title, id: `header_${group.title}` });
    flatData.push(...group.data);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Movimentações</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/movement/add");
            }}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="add" size={24} color={Colors.white} />
          </Pressable>
        </View>
        <View style={styles.filterRow}>
          {(["all", "entry", "exit"] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f);
              }}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === "all" ? "Todas" : f === "entry" ? "Entradas" : "Saídas"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={flatData}
        keyExtractor={(item) => ("title" in item && "type" in item && item.type === "header" ? (item as any).id : (item as Movement).id)}
        renderItem={renderItem as any}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="swap-horizontal" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Sem movimentações</Text>
            <Text style={styles.emptyText}>Registre entradas e saídas de estoque</Text>
          </View>
        }
      />
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "web" ? 34 : 100,
  },
  dateHeader: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  movItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  movIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  movContent: {
    flex: 1,
    marginRight: 8,
  },
  movProduct: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  movNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  movRight: {
    alignItems: "flex-end",
  },
  movQty: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  movTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
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
