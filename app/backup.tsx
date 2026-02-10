import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  getProducts,
  getCategories,
  getMovements,
  exportAllData,
  importAllData,
  clearAllData,
  BackupData,
} from "@/lib/storage";

function ActionCard({
  icon,
  iconColor,
  iconBg,
  title,
  description,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        danger && styles.actionCardDanger,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.actionInfo}>
        <Text style={[styles.actionTitle, danger && { color: Colors.danger }]}>{title}</Text>
        <Text style={styles.actionDesc}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

export default function BackupScreen() {
  const [productCount, setProductCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [movementCount, setMovementCount] = useState(0);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadCounts = useCallback(async () => {
    const [p, c, m] = await Promise.all([getProducts(), getCategories(), getMovements()]);
    setProductCount(p.length);
    setCategoryCount(c.length);
    setMovementCount(m.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  const handleExportFile = async () => {
    try {
      setExporting(true);
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `estoque_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert("Sucesso", "Backup exportado com sucesso!");
      } else {
        const path = `${FileSystem.cacheDirectory}estoque_backup_${dateStr}.json`;
        await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Exportar Backup" });
        } else {
          Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo");
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Erro ao exportar dados");
    } finally {
      setExporting(false);
    }
  };

  const handleExportClipboard = async () => {
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);

      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(json);
      } else {
        const Clipboard = require("expo-clipboard");
        await Clipboard.setStringAsync(json);
      }

      Alert.alert("Copiado!", "Os dados foram copiados para a área de transferência.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Erro ao copiar dados");
    }
  };

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      let content: string;

      if (Platform.OS === "web") {
        const response = await fetch(asset.uri);
        content = await response.text();
      } else {
        content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      }

      const data: BackupData = JSON.parse(content);
      if (!data.categories || !data.products || !data.movements) {
        Alert.alert("Erro", "Arquivo de backup inválido. Formato não reconhecido.");
        return;
      }

      const confirmMsg = `Este backup contém:\n- ${data.categories.length} categorias\n- ${data.products.length} produtos\n- ${data.movements.length} movimentações\n\nIsso substituirá todos os dados atuais. Continuar?`;

      if (Platform.OS === "web") {
        const confirmed = window.confirm(confirmMsg);
        if (!confirmed) return;
        await importAllData(data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Sucesso", "Dados importados com sucesso!");
        loadCounts();
      } else {
        Alert.alert("Importar Backup", confirmMsg, [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Importar",
            style: "destructive",
            onPress: async () => {
              await importAllData(data);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Sucesso", "Dados importados com sucesso!");
              loadCounts();
            },
          },
        ]);
      }
    } catch (e: any) {
      Alert.alert("Erro", "Não foi possível ler o arquivo. Verifique o formato.");
    }
  };

  const handleImportText = async () => {
    try {
      const data: BackupData = JSON.parse(importText);
      if (!data.categories || !data.products || !data.movements) {
        Alert.alert("Erro", "Dados inválidos. Formato não reconhecido.");
        return;
      }

      await importAllData(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setImportModalVisible(false);
      setImportText("");
      Alert.alert("Sucesso", "Dados importados com sucesso!");
      loadCounts();
    } catch {
      Alert.alert("Erro", "JSON inválido. Verifique os dados colados.");
    }
  };

  const handleClearData = () => {
    const msg = "Isso excluirá TODOS os dados: produtos, categorias e movimentações. Esta ação não pode ser desfeita.";

    if (Platform.OS === "web") {
      const confirmed = window.confirm(msg);
      if (!confirmed) return;
      clearAllData().then(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Dados excluídos", "Todos os dados foram removidos.");
        loadCounts();
      });
    } else {
      Alert.alert("Limpar Todos os Dados", msg, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir Tudo",
          style: "destructive",
          onPress: async () => {
            await clearAllData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Dados excluídos", "Todos os dados foram removidos.");
            loadCounts();
          },
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Ionicons name="cube-outline" size={14} color={Colors.primary} />
            <Text style={styles.statPillText}>{productCount} produtos</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="pricetags-outline" size={14} color="#8B5CF6" />
            <Text style={styles.statPillText}>{categoryCount} categorias</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="swap-horizontal" size={14} color="#3B82F6" />
            <Text style={styles.statPillText}>{movementCount} movim.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Exportar Dados</Text>
        <ActionCard
          icon="download-outline"
          iconColor={Colors.primary}
          iconBg="#E0F2F1"
          title="Exportar como Arquivo"
          description="Salva um arquivo JSON com todos os dados"
          onPress={handleExportFile}
        />
        <ActionCard
          icon="copy-outline"
          iconColor="#3B82F6"
          iconBg="#DBEAFE"
          title="Copiar para Área de Transferência"
          description="Copia os dados em formato JSON"
          onPress={handleExportClipboard}
        />

        <Text style={styles.sectionTitle}>Importar Dados</Text>
        <ActionCard
          icon="folder-open-outline"
          iconColor="#10B981"
          iconBg={Colors.successLight}
          title="Importar de Arquivo"
          description="Selecione um arquivo JSON de backup"
          onPress={handleImportFile}
        />
        <ActionCard
          icon="clipboard-outline"
          iconColor="#8B5CF6"
          iconBg="#EDE9FE"
          title="Colar Dados (JSON)"
          description="Cole dados de backup copiados anteriormente"
          onPress={() => setImportModalVisible(true)}
        />

        <Text style={styles.sectionTitle}>Gerenciamento</Text>
        <ActionCard
          icon="trash-outline"
          iconColor={Colors.danger}
          iconBg={Colors.dangerLight}
          title="Limpar Todos os Dados"
          description="Remove todos os produtos, categorias e movimentações"
          onPress={handleClearData}
          danger
        />

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            Os dados são armazenados localmente no dispositivo. Exporte regularmente para não perder seus dados.
          </Text>
        </View>

        <View style={{ height: Platform.OS === "web" ? 34 : 40 }} />
      </ScrollView>

      <Modal
        visible={importModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Colar Dados JSON</Text>
              <Pressable onPress={() => setImportModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            <Text style={styles.modalHint}>
              Cole abaixo os dados JSON exportados anteriormente:
            </Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={8}
              value={importText}
              onChangeText={setImportText}
              placeholder='{"version":1,"categories":[...],"products":[...],"movements":[...]}'
              placeholderTextColor={Colors.textTertiary}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setImportModalVisible(false)}
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleImportText}
                style={({ pressed }) => [
                  styles.importBtn,
                  pressed && { opacity: 0.8 },
                  !importText.trim() && { opacity: 0.5 },
                ]}
                disabled={!importText.trim()}
              >
                <Ionicons name="download-outline" size={18} color={Colors.white} />
                <Text style={styles.importBtnText}>Importar</Text>
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
  content: {
    padding: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statPillText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 12,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 14,
  },
  actionCardDanger: {
    borderColor: "#FECACA",
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  actionDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
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
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  modalHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    minHeight: 150,
    marginBottom: 16,
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
  importBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  importBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
