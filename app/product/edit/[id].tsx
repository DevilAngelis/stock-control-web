import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getProduct, getCategories, updateProduct, Category } from "@/lib/storage";

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [minStock, setMinStock] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("un");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const units = ["un", "kg", "g", "L", "ml", "cx", "pct", "m"];

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      Promise.all([getProduct(id), getCategories()]).then(([p, cats]) => {
        if (!p) return;
        setName(p.name);
        setCategoryId(p.categoryId);
        setMinStock(p.minStock.toString());
        setPrice(p.price.toFixed(2).replace(".", ","));
        setUnit(p.unit);
        setCategories(cats);
        setLoaded(true);
      });
    }, [id])
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Informe o nome do produto");
      return;
    }
    if (!categoryId) {
      Alert.alert("Erro", "Selecione uma categoria");
      return;
    }
    const min = parseInt(minStock) || 0;
    const p = parseFloat(price.replace(",", ".")) || 0;

    setSaving(true);
    try {
      await updateProduct(id!, {
        name: name.trim(),
        categoryId,
        minStock: min,
        price: p,
        unit,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Erro", "Falha ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
      <Text style={styles.label}>Nome do Produto</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Arroz Integral 1kg"
        placeholderTextColor={Colors.textTertiary}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.catGrid}>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => {
              Haptics.selectionAsync();
              setCategoryId(cat.id);
            }}
            style={[styles.catChip, categoryId === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
          >
            <View style={[styles.catDot, { backgroundColor: categoryId === cat.id ? Colors.white : cat.color }]} />
            <Text style={[styles.catChipText, categoryId === cat.id && { color: Colors.white }]}>{cat.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Estoque Mínimo</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
            value={minStock}
            onChangeText={setMinStock}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Preço Unitário (R$)</Text>
          <TextInput
            style={styles.input}
            placeholder="0,00"
            placeholderTextColor={Colors.textTertiary}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Text style={styles.label}>Unidade</Text>
      <View style={styles.unitGrid}>
        {units.map((u) => (
          <Pressable
            key={u}
            onPress={() => {
              Haptics.selectionAsync();
              setUnit(u);
            }}
            style={[styles.unitChip, unit === u && styles.unitChipActive]}
          >
            <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }, saving && { opacity: 0.6 }]}
      >
        <Ionicons name="checkmark" size={20} color={Colors.white} />
        <Text style={styles.saveBtnText}>{saving ? "Salvando..." : "Salvar Alterações"}</Text>
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
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
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
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  unitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 20,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unitText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  unitTextActive: {
    color: Colors.white,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
