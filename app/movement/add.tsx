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
import { getProducts, addMovement, Product } from "@/lib/storage";

export default function AddMovementScreen() {
  const params = useLocalSearchParams<{ productId?: string; type?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>(params.productId ?? "");
  const [type, setType] = useState<"entry" | "exit">((params.type as "entry" | "exit") ?? "entry");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");

  useFocusEffect(
    useCallback(() => {
      getProducts().then((p) => setProducts(p.sort((a, b) => a.name.localeCompare(b.name))));
    }, [])
  );

  const handleSave = async () => {
    if (!selectedProduct) {
      Alert.alert("Erro", "Selecione um produto");
      return;
    }
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      Alert.alert("Erro", "Informe uma quantidade válida");
      return;
    }
    if (type === "exit") {
      const product = products.find((p) => p.id === selectedProduct);
      if (product && qty > product.quantity) {
        Alert.alert("Erro", `Quantidade disponível: ${product.quantity} ${product.unit}`);
        return;
      }
    }

    setSaving(true);
    try {
      await addMovement({
        productId: selectedProduct,
        type,
        quantity: qty,
        note: note.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Erro", "Falha ao registrar movimentação");
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = searchText
    ? products.filter((p) => p.name.toLowerCase().includes(searchText.toLowerCase()))
    : products;

  const selectedProductData = products.find((p) => p.id === selectedProduct);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
      <Text style={styles.label}>Tipo de Movimentação</Text>
      <View style={styles.typeRow}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setType("entry");
          }}
          style={[styles.typeBtn, type === "entry" && styles.typeBtnEntryActive]}
        >
          <Ionicons name="arrow-down" size={18} color={type === "entry" ? Colors.white : Colors.success} />
          <Text style={[styles.typeBtnText, type === "entry" && { color: Colors.white }]}>Entrada</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setType("exit");
          }}
          style={[styles.typeBtn, type === "exit" && styles.typeBtnExitActive]}
        >
          <Ionicons name="arrow-up" size={18} color={type === "exit" ? Colors.white : Colors.danger} />
          <Text style={[styles.typeBtnText, type === "exit" && { color: Colors.white }]}>Saída</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Produto</Text>
      {selectedProductData ? (
        <View style={styles.selectedProduct}>
          <View style={styles.selectedLeft}>
            <Ionicons name="cube" size={20} color={Colors.primary} />
            <View>
              <Text style={styles.selectedName}>{selectedProductData.name}</Text>
              <Text style={styles.selectedQty}>Estoque: {selectedProductData.quantity} {selectedProductData.unit}</Text>
            </View>
          </View>
          <Pressable onPress={() => setSelectedProduct("")}>
            <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar produto..."
              placeholderTextColor={Colors.textTertiary}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          <View style={styles.productList}>
            {filteredProducts.length === 0 ? (
              <Text style={styles.noProducts}>Nenhum produto encontrado</Text>
            ) : (
              filteredProducts.slice(0, 8).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedProduct(p.id);
                    setSearchText("");
                  }}
                  style={({ pressed }) => [styles.productItem, pressed && { backgroundColor: Colors.surfaceElevated }]}
                >
                  <Text style={styles.productItemName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.productItemQty}>{p.quantity} {p.unit}</Text>
                </Pressable>
              ))
            )}
          </View>
        </>
      )}

      <Text style={styles.label}>Quantidade</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor={Colors.textTertiary}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Observação (opcional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Ex: Compra do fornecedor X"
        placeholderTextColor={Colors.textTertiary}
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
      />

      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={({ pressed }) => [
          styles.saveBtn,
          { backgroundColor: type === "entry" ? Colors.success : Colors.danger },
          pressed && { opacity: 0.9 },
          saving && { opacity: 0.6 },
        ]}
      >
        <Ionicons name={type === "entry" ? "arrow-down" : "arrow-up"} size={20} color={Colors.white} />
        <Text style={styles.saveBtnText}>
          {saving ? "Salvando..." : type === "entry" ? "Registrar Entrada" : "Registrar Saída"}
        </Text>
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
  typeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnEntryActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  typeBtnExitActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  typeBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  selectedProduct: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: 14,
    marginBottom: 20,
  },
  selectedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  selectedName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  selectedQty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  productList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    overflow: "hidden",
  },
  productItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  productItemName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  productItemQty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  noProducts: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    paddingVertical: 20,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: "top" as const,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
