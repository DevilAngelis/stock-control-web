import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  Category,
} from "@/lib/storage";

const PRESET_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
  "#6366F1", "#84CC16", "#06B6D4", "#64748B",
];

function CategoryRow({
  category,
  productCount,
  onEdit,
  onDelete,
}: {
  category: Category;
  productCount: number;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}) {
  return (
    <View style={styles.catRow}>
      <View style={[styles.catColorBar, { backgroundColor: category.color }]} />
      <View style={styles.catInfo}>
        <Text style={styles.catName}>{category.name}</Text>
        <Text style={styles.catCount}>
          {productCount} {productCount === 1 ? "produto" : "produtos"}
        </Text>
      </View>
      <View style={styles.catActions}>
        <Pressable
          onPress={() => onEdit(category)}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="create-outline" size={20} color={Colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(category)}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(PRESET_COLORS[0]);

  const loadData = useCallback(async () => {
    const [cats, prods] = await Promise.all([getCategories(), getProducts()]);
    setCategories(cats);
    const counts: Record<string, number> = {};
    for (const cat of cats) {
      counts[cat.id] = prods.filter((p) => p.categoryId === cat.id).length;
    }
    setProductCounts(counts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openAdd = () => {
    setEditingCategory(null);
    setCatName("");
    setCatColor(PRESET_COLORS[0]);
    setModalVisible(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatColor(cat.color);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!catName.trim()) {
      Alert.alert("Erro", "Informe o nome da categoria");
      return;
    }
    if (editingCategory) {
      await updateCategory(editingCategory.id, { name: catName.trim(), color: catColor });
    } else {
      await addCategory(catName.trim(), catColor);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
    loadData();
  };

  const handleDelete = async (cat: Category) => {
    const count = productCounts[cat.id] ?? 0;
    if (count > 0) {
      Alert.alert(
        "Categoria em uso",
        `Esta categoria possui ${count} ${count === 1 ? "produto associado" : "produtos associados"}. Remova ou mude a categoria dos produtos antes de excluir.`
      );
      return;
    }
    if (Platform.OS === "web") {
      const confirmed = window.confirm(`Deseja excluir "${cat.name}"?`);
      if (!confirmed) return;
      await deleteCategory(cat.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    } else {
      Alert.alert("Excluir Categoria", `Deseja excluir "${cat.name}"?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            await deleteCategory(cat.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadData();
          },
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CategoryRow
            category={item}
            productCount={productCounts[item.id] ?? 0}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Pressable
            onPress={openAdd}
            style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.addIconWrap}>
              <Ionicons name="add" size={22} color={Colors.white} />
            </View>
            <Text style={styles.addText}>Nova Categoria</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nenhuma categoria</Text>
            <Text style={styles.emptyText}>Crie categorias para organizar seus produtos</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory ? "Editar Categoria" : "Nova Categoria"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Eletrônicos"
              placeholderTextColor={Colors.textTertiary}
              value={catName}
              onChangeText={setCatName}
              autoFocus
            />

            <Text style={styles.label}>Cor</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCatColor(c);
                  }}
                  style={[styles.colorCircle, { backgroundColor: c }]}
                >
                  {catColor === c && (
                    <Ionicons name="checkmark" size={18} color={Colors.white} />
                  )}
                </Pressable>
              ))}
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Prévia:</Text>
              <View style={[styles.previewChip, { borderColor: catColor }]}>
                <View style={[styles.previewDot, { backgroundColor: catColor }]} />
                <Text style={styles.previewText}>{catName || "Nome da categoria"}</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="checkmark" size={18} color={Colors.white} />
                <Text style={styles.saveBtnText}>
                  {editingCategory ? "Salvar" : "Criar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 40,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: "dashed" as const,
  },
  addIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  catColorBar: {
    width: 6,
    height: 40,
    borderRadius: 3,
    marginRight: 14,
  },
  catInfo: {
    flex: 1,
  },
  catName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  catCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  catActions: {
    flexDirection: "row",
    gap: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === "web" ? 34 : 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    marginBottom: 20,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  previewLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  previewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  previewText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
