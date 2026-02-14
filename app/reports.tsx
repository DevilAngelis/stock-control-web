import React, { useCallback, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Pressable,
  FlatList,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Print from "expo-print";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  getProducts,
  getCategories,
  getMovements,
  Product,
  Category,
  Movement,
} from "@/lib/storage";

type ReportTab = "entries" | "exits" | "general" | "consumption";
type Period = "7d" | "30d" | "90d" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  all: "Tudo",
};

const TAB_CONFIG: { key: ReportTab; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: "entries", label: "Entradas", icon: "arrow-down", color: Colors.success },
  { key: "exits", label: "Saídas", icon: "arrow-up", color: Colors.danger },
  { key: "general", label: "Geral", icon: "stats-chart", color: "#3B82F6" },
  { key: "consumption", label: "Consumo", icon: "flash", color: "#8B5CF6" },
];

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function BarRow({ label, value, displayValue, maxValue, color }: { label: string; value: number; displayValue?: string; maxValue: number; color: string }) {
  const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 4;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${width}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{displayValue ?? value}</Text>
    </View>
  );
}

function MovementRow({ movement, product }: { movement: Movement; product?: Product }) {
  const isEntry = movement.type === "entry";
  return (
    <View style={styles.movRow}>
      <View style={[styles.movDot, { backgroundColor: isEntry ? Colors.success : Colors.danger }]} />
      <View style={styles.movInfo}>
        <Text style={styles.movName} numberOfLines={1}>{product?.name ?? "Produto removido"}</Text>
        <Text style={styles.movMeta}>{formatDate(movement.createdAt)}{movement.note ? ` - ${movement.note}` : ""}</Text>
      </View>
      <View style={styles.movRight}>
        <Text style={[styles.movQty, { color: isEntry ? Colors.success : Colors.danger }]}>
          {isEntry ? "+" : "-"}{movement.quantity}
        </Text>
        {product && <Text style={styles.movVal}>{formatCurrency(movement.quantity * product.price)}</Text>}
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [tab, setTab] = useState<ReportTab>("entries");
  const [period, setPeriod] = useState<Period>("30d");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);

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

  const filtered = useMemo(() => {
    let result = filterByPeriod(movements, period);
    if (selectedProductIds.length > 0) {
      result = result.filter((m) => selectedProductIds.includes(m.productId));
    }
    return result;
  }, [movements, period, selectedProductIds]);

  const entries = useMemo(() => filtered.filter((m) => m.type === "entry"), [filtered]);
  const exits = useMemo(() => filtered.filter((m) => m.type === "exit"), [filtered]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearFilters = () => setSelectedProductIds([]);

  const totalEntryQty = entries.reduce((a, m) => a + m.quantity, 0);
  const totalExitQty = exits.reduce((a, m) => a + m.quantity, 0);
  const entryValue = entries.reduce((acc, m) => acc + m.quantity * (products.find((p) => p.id === m.productId)?.price ?? 0), 0);
  const exitValue = exits.reduce((acc, m) => acc + m.quantity * (products.find((p) => p.id === m.productId)?.price ?? 0), 0);

  const consumptionData = useMemo(() => {
    const exitsByProduct: Record<string, { total: number; dates: string[] }> = {};
    exits.forEach((m) => {
      if (!exitsByProduct[m.productId]) exitsByProduct[m.productId] = { total: 0, dates: [] };
      exitsByProduct[m.productId].total += m.quantity;
      exitsByProduct[m.productId].dates.push(m.createdAt);
    });

    const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;

    return Object.entries(exitsByProduct)
      .map(([productId, data]) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return null;
        const category = categories.find((c) => c.id === product.categoryId);

        const sortedDates = data.dates.sort();
        const firstDate = new Date(sortedDates[0]);
        const lastDate = new Date(sortedDates[sortedDates.length - 1]);
        const daySpan = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
        const actualDays = periodDays ?? daySpan;

        const dailyAvg = data.total / Math.max(actualDays, 1);
        const monthlyProjection = dailyAvg * 30;
        const daysUntilEmpty = dailyAvg > 0 ? Math.round(product.quantity / dailyAvg) : null;

        let status: "critical" | "warning" | "ok" = "ok";
        if (daysUntilEmpty !== null && daysUntilEmpty <= 7) status = "critical";
        else if (daysUntilEmpty !== null && daysUntilEmpty <= 30) status = "warning";

        return {
          product,
          category,
          totalConsumed: data.total,
          movCount: data.dates.length,
          dailyAvg,
          monthlyProjection,
          daysUntilEmpty,
          status,
          costProjection: monthlyProjection * product.price,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.totalConsumed - a!.totalConsumed) as NonNullable<typeof consumptionData[0]>[];
  }, [exits, products, categories, period]);

  const topEntryByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((m) => { map[m.productId] = (map[m.productId] ?? 0) + m.quantity; });
    return Object.entries(map)
      .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
      .filter((x) => x.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [entries, products]);

  const topExitByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    exits.forEach((m) => { map[m.productId] = (map[m.productId] ?? 0) + m.quantity; });
    return Object.entries(map)
      .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
      .filter((x) => x.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [exits, products]);

  const categoryBreakdown = useMemo(() => {
    return categories.map((cat) => {
      const catProducts = products.filter((p) => p.categoryId === cat.id);
      const totalQty = catProducts.reduce((a, p) => a + p.quantity, 0);
      const totalVal = catProducts.reduce((a, p) => a + p.quantity * p.price, 0);
      return { category: cat, productCount: catProducts.length, totalQty, totalVal };
    }).filter((c) => c.productCount > 0).sort((a, b) => b.totalVal - a.totalVal);
  }, [categories, products]);

  const renderContent = () => {
    if (tab === "entries") return renderEntriesReport();
    if (tab === "exits") return renderExitsReport();
    if (tab === "general") return renderGeneralReport();
    return renderConsumptionReport();
  };

  const renderEntriesReport = () => {
    const maxEntry = topEntryByProduct.length > 0 ? topEntryByProduct[0].qty : 1;
    return (
      <>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { borderColor: Colors.successLight }]}>
            <Ionicons name="arrow-down" size={16} color={Colors.success} />
            <View>
              <Text style={styles.summaryPillValue}>{totalEntryQty} un.</Text>
              <Text style={styles.summaryPillLabel}>{formatCurrency(entryValue)}</Text>
            </View>
          </View>
          <View style={[styles.summaryPill, { borderColor: Colors.borderLight }]}>
            <Ionicons name="receipt-outline" size={16} color={Colors.textSecondary} />
            <View>
              <Text style={styles.summaryPillValue}>{entries.length}</Text>
              <Text style={styles.summaryPillLabel}>registros</Text>
            </View>
          </View>
        </View>

        {topEntryByProduct.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ranking por Produto</Text>
            <View style={styles.chartCard}>
              {topEntryByProduct.map((item) => (
                <BarRow key={item.product!.id} label={item.product!.name} value={item.qty} maxValue={maxEntry} color={Colors.success} />
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Histórico de Entradas</Text>
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="arrow-down-circle-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Nenhuma entrada no período</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {entries.map((m) => <MovementRow key={m.id} movement={m} product={products.find((p) => p.id === m.productId)} />)}
          </View>
        )}
      </>
    );
  };

  const renderExitsReport = () => {
    const maxExit = topExitByProduct.length > 0 ? topExitByProduct[0].qty : 1;
    return (
      <>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { borderColor: Colors.dangerLight }]}>
            <Ionicons name="arrow-up" size={16} color={Colors.danger} />
            <View>
              <Text style={styles.summaryPillValue}>{totalExitQty} un.</Text>
              <Text style={styles.summaryPillLabel}>{formatCurrency(exitValue)}</Text>
            </View>
          </View>
          <View style={[styles.summaryPill, { borderColor: Colors.borderLight }]}>
            <Ionicons name="receipt-outline" size={16} color={Colors.textSecondary} />
            <View>
              <Text style={styles.summaryPillValue}>{exits.length}</Text>
              <Text style={styles.summaryPillLabel}>registros</Text>
            </View>
          </View>
        </View>

        {topExitByProduct.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ranking por Produto</Text>
            <View style={styles.chartCard}>
              {topExitByProduct.map((item) => (
                <BarRow key={item.product!.id} label={item.product!.name} value={item.qty} maxValue={maxExit} color={Colors.danger} />
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Histórico de Saídas</Text>
        {exits.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="arrow-up-circle-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Nenhuma saída no período</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {exits.map((m) => <MovementRow key={m.id} movement={m} product={products.find((p) => p.id === m.productId)} />)}
          </View>
        )}
      </>
    );
  };

  const renderGeneralReport = () => {
    const totalStockValue = products.reduce((a, p) => a + p.quantity * p.price, 0);
    const avgPrice = products.length > 0 ? products.reduce((a, p) => a + p.price, 0) / products.length : 0;
    const lowStock = products.filter((p) => p.quantity <= p.minStock);
    const zeroStock = products.filter((p) => p.quantity === 0);
    const maxCatVal = categoryBreakdown.length > 0 ? categoryBreakdown[0].totalVal : 1;

    return (
      <>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { borderColor: "#E0F2F1" }]}>
            <Ionicons name="arrow-down" size={16} color={Colors.success} />
            <View>
              <Text style={styles.summaryPillValue}>+{totalEntryQty}</Text>
              <Text style={styles.summaryPillLabel}>entradas</Text>
            </View>
          </View>
          <View style={[styles.summaryPill, { borderColor: Colors.dangerLight }]}>
            <Ionicons name="arrow-up" size={16} color={Colors.danger} />
            <View>
              <Text style={styles.summaryPillValue}>-{totalExitQty}</Text>
              <Text style={styles.summaryPillLabel}>saídas</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resumo do Estoque</Text>
        <View style={styles.overviewCard}>
          <View style={styles.overviewRow}>
            <Text style={styles.overviewLabel}>Valor total em estoque</Text>
            <Text style={styles.overviewValueText}>{formatCurrency(totalStockValue)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.overviewRow}>
            <Text style={styles.overviewLabel}>Total de produtos</Text>
            <Text style={styles.overviewValueText}>{products.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.overviewRow}>
            <Text style={styles.overviewLabel}>Preço médio unitário</Text>
            <Text style={styles.overviewValueText}>{formatCurrency(avgPrice)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.overviewRow}>
            <Text style={styles.overviewLabel}>Saldo líquido (período)</Text>
            <Text style={[styles.overviewValueText, { color: totalEntryQty - totalExitQty >= 0 ? Colors.success : Colors.danger }]}>
              {totalEntryQty - totalExitQty >= 0 ? "+" : ""}{totalEntryQty - totalExitQty} un.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.overviewRow}>
            <Text style={styles.overviewLabel}>Estoque baixo</Text>
            <Text style={[styles.overviewValueText, lowStock.length > 0 && { color: Colors.warning }]}>{lowStock.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.overviewRow}>
            <Text style={styles.overviewLabel}>Sem estoque</Text>
            <Text style={[styles.overviewValueText, zeroStock.length > 0 && { color: Colors.danger }]}>{zeroStock.length}</Text>
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
                  value={item.totalVal}
                  displayValue={formatCurrency(item.totalVal)}
                  maxValue={maxCatVal}
                  color={item.category.color}
                />
              ))}
            </View>
          </>
        )}
      </>
    );
  };

  const renderConsumptionReport = () => {
    const criticalItems = consumptionData.filter((c) => c.status === "critical");
    const warningItems = consumptionData.filter((c) => c.status === "warning");
    const totalMonthlyCost = consumptionData.reduce((a, c) => a + c.costProjection, 0);

    return (
      <>
        {(criticalItems.length > 0 || warningItems.length > 0) && (
          <View style={styles.alertBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.alertBannerText}>
              {criticalItems.length > 0 && `${criticalItems.length} material(is) acabam em menos de 7 dias`}
              {criticalItems.length > 0 && warningItems.length > 0 && " | "}
              {warningItems.length > 0 && `${warningItems.length} em até 30 dias`}
            </Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { borderColor: "#EDE9FE" }]}>
            <Ionicons name="flash" size={16} color="#8B5CF6" />
            <View>
              <Text style={styles.summaryPillValue}>{consumptionData.length}</Text>
              <Text style={styles.summaryPillLabel}>materiais consumidos</Text>
            </View>
          </View>
          <View style={[styles.summaryPill, { borderColor: Colors.borderLight }]}>
            <Ionicons name="wallet-outline" size={16} color={Colors.textSecondary} />
            <View>
              <Text style={styles.summaryPillValue}>{formatCurrency(totalMonthlyCost)}</Text>
              <Text style={styles.summaryPillLabel}>projeção mensal</Text>
            </View>
          </View>
        </View>

        {consumptionData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flash-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Sem dados de consumo no período</Text>
            <Text style={styles.emptySubText}>Registre saídas de materiais para gerar análises</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Análise por Material</Text>
            {consumptionData.map((item) => (
              <View key={item.product.id} style={[styles.consumptionCard, item.status === "critical" && styles.consumptionCritical, item.status === "warning" && styles.consumptionWarning]}>
                <View style={styles.consumptionHeader}>
                  <View style={styles.consumptionLeft}>
                    {item.category && <View style={[styles.catDot, { backgroundColor: item.category.color }]} />}
                    <Text style={styles.consumptionName} numberOfLines={1}>{item.product.name}</Text>
                  </View>
                  {item.status !== "ok" && (
                    <View style={[styles.statusBadge, item.status === "critical" ? styles.badgeCritical : styles.badgeWarning]}>
                      <Ionicons name={item.status === "critical" ? "alert-circle" : "warning"} size={12} color={item.status === "critical" ? Colors.danger : "#D97706"} />
                      <Text style={[styles.statusText, item.status === "critical" ? { color: Colors.danger } : { color: "#D97706" }]}>
                        {item.status === "critical" ? "Crítico" : "Atenção"}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.consumptionGrid}>
                  <View style={styles.consumptionStat}>
                    <Text style={styles.consumptionStatLabel}>Consumido</Text>
                    <Text style={styles.consumptionStatValue}>{item.totalConsumed} un.</Text>
                  </View>
                  <View style={styles.consumptionStat}>
                    <Text style={styles.consumptionStatLabel}>Média/dia</Text>
                    <Text style={styles.consumptionStatValue}>{item.dailyAvg.toFixed(1)}</Text>
                  </View>
                  <View style={styles.consumptionStat}>
                    <Text style={styles.consumptionStatLabel}>Projeção/mês</Text>
                    <Text style={styles.consumptionStatValue}>{Math.round(item.monthlyProjection)}</Text>
                  </View>
                  <View style={styles.consumptionStat}>
                    <Text style={styles.consumptionStatLabel}>Estoque atual</Text>
                    <Text style={[styles.consumptionStatValue, item.product.quantity <= item.product.minStock && { color: Colors.danger }]}>
                      {item.product.quantity} un.
                    </Text>
                  </View>
                </View>

                <View style={styles.consumptionFooter}>
                  <View style={styles.consumptionFooterItem}>
                    <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
                    <Text style={styles.consumptionFooterText}>
                      {item.daysUntilEmpty !== null
                        ? `Acaba em ~${item.daysUntilEmpty} dias`
                        : "Sem consumo recente"}
                    </Text>
                  </View>
                  <View style={styles.consumptionFooterItem}>
                    <Ionicons name="cash-outline" size={14} color={Colors.textTertiary} />
                    <Text style={styles.consumptionFooterText}>
                      {formatCurrency(item.costProjection)}/mês
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </>
    );
  };

  const buildPrintHtml = () => {
    const tabLabel = TAB_CONFIG.find((t) => t.key === tab)?.label ?? "";
    const periodLabel = PERIOD_LABELS[period];
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const filterNote = selectedProductIds.length > 0 ? `Filtro: ${selectedProductIds.length} produto(s) selecionado(s)` : "Sem filtro (Todos produtos)";

    const css = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B; padding: 24px; font-size: 12px; }
        .header { text-align: center; border-bottom: 2px solid #0D9488; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 18px; color: #0D9488; letter-spacing: 3px; margin-bottom: 4px; }
        .header h2 { font-size: 14px; color: #334155; }
        .header .meta { font-size: 11px; color: #64748B; margin-top: 6px; }
        .section-title { font-size: 13px; font-weight: 700; color: #0F172A; margin: 16px 0 8px; border-left: 3px solid #0D9488; padding-left: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background-color: #F1F5F9; font-weight: 600; text-align: left; padding: 8px; border-bottom: 2px solid #CBD5E1; font-size: 11px; color: #475569; }
        td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; font-size: 11px; }
        tr:nth-child(even) { background-color: #F8FAFC; }
        .summary-box { display: flex; gap: 16px; margin-bottom: 16px; }
        .summary-item { flex: 1; background: #F1F5F9; border-radius: 8px; padding: 12px; text-align: center; }
        .summary-item .value { font-size: 18px; font-weight: 700; color: #0F172A; }
        .summary-item .label { font-size: 10px; color: #64748B; margin-top: 2px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
        .badge-critical { background: #FEE2E2; color: #DC2626; }
        .badge-warning { background: #FEF3C7; color: #D97706; }
        .badge-ok { background: #E0F2F1; color: #0D9488; }
        .entry { color: #10B981; }
        .exit { color: #EF4444; }
        .footer { text-align: center; font-size: 10px; color: #94A3B8; margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 8px; }
        @media print { body { padding: 12px; } }
      </style>`;

    let body = "";

    if (tab === "entries") {
      body += `<div class="summary-box">
        <div class="summary-item"><div class="value entry">+${totalEntryQty} un.</div><div class="label">Total Entradas</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(entryValue)}</div><div class="label">Valor Total</div></div>
        <div class="summary-item"><div class="value">${entries.length}</div><div class="label">Registros</div></div>
      </div>`;
      if (topEntryByProduct.length > 0) {
        body += `<div class="section-title">Ranking por Produto</div><table><tr><th>Produto</th><th style="text-align:right">Quantidade</th></tr>`;
        topEntryByProduct.forEach((item) => {
          body += `<tr><td>${item.product!.name}</td><td style="text-align:right">${item.qty}</td></tr>`;
        });
        body += `</table>`;
      }
      body += `<div class="section-title">Histórico de Entradas</div>`;
      if (entries.length === 0) {
        body += `<p>Nenhuma entrada no período.</p>`;
      } else {
        body += `<table><tr><th>Data</th><th>Produto</th><th style="text-align:right">Qtd</th><th>Observação</th></tr>`;
        entries.forEach((m) => {
          const p = products.find((pr) => pr.id === m.productId);
          body += `<tr><td>${formatDate(m.createdAt)}</td><td>${p?.name ?? "Removido"}</td><td style="text-align:right" class="entry">+${m.quantity}</td><td>${m.note || "-"}</td></tr>`;
        });
        body += `</table>`;
      }
    } else if (tab === "exits") {
      body += `<div class="summary-box">
        <div class="summary-item"><div class="value exit">-${totalExitQty} un.</div><div class="label">Total Saídas</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(exitValue)}</div><div class="label">Valor Total</div></div>
        <div class="summary-item"><div class="value">${exits.length}</div><div class="label">Registros</div></div>
      </div>`;
      if (topExitByProduct.length > 0) {
        body += `<div class="section-title">Ranking por Produto</div><table><tr><th>Produto</th><th style="text-align:right">Quantidade</th></tr>`;
        topExitByProduct.forEach((item) => {
          body += `<tr><td>${item.product!.name}</td><td style="text-align:right">${item.qty}</td></tr>`;
        });
        body += `</table>`;
      }
      body += `<div class="section-title">Histórico de Saídas</div>`;
      if (exits.length === 0) {
        body += `<p>Nenhuma saída no período.</p>`;
      } else {
        body += `<table><tr><th>Data</th><th>Produto</th><th style="text-align:right">Qtd</th><th>Observação</th></tr>`;
        exits.forEach((m) => {
          const p = products.find((pr) => pr.id === m.productId);
          body += `<tr><td>${formatDate(m.createdAt)}</td><td>${p?.name ?? "Removido"}</td><td style="text-align:right" class="exit">-${m.quantity}</td><td>${m.note || "-"}</td></tr>`;
        });
        body += `</table>`;
      }
    } else if (tab === "general") {
      const totalStockValue = products.reduce((a, p) => a + p.quantity * p.price, 0);
      const avgPrice = products.length > 0 ? products.reduce((a, p) => a + p.price, 0) / products.length : 0;
      const lowStock = products.filter((p) => p.quantity <= p.minStock);
      const zeroStock = products.filter((p) => p.quantity === 0);

      body += `<div class="summary-box">
        <div class="summary-item"><div class="value entry">+${totalEntryQty}</div><div class="label">Entradas</div></div>
        <div class="summary-item"><div class="value exit">-${totalExitQty}</div><div class="label">Saídas</div></div>
        <div class="summary-item"><div class="value">${totalEntryQty - totalExitQty >= 0 ? "+" : ""}${totalEntryQty - totalExitQty}</div><div class="label">Saldo</div></div>
      </div>`;

      body += `<div class="section-title">Resumo do Estoque</div>
      <table>
        <tr><td>Valor total em estoque</td><td style="text-align:right; font-weight:600">${formatCurrency(totalStockValue)}</td></tr>
        <tr><td>Total de produtos</td><td style="text-align:right; font-weight:600">${products.length}</td></tr>
        <tr><td>Preço médio unitário</td><td style="text-align:right; font-weight:600">${formatCurrency(avgPrice)}</td></tr>
        <tr><td>Estoque baixo</td><td style="text-align:right; font-weight:600; color:${lowStock.length > 0 ? "#D97706" : "#0F172A"}">${lowStock.length}</td></tr>
        <tr><td>Sem estoque</td><td style="text-align:right; font-weight:600; color:${zeroStock.length > 0 ? "#DC2626" : "#0F172A"}">${zeroStock.length}</td></tr>
      </table>`;

      if (categoryBreakdown.length > 0) {
        body += `<div class="section-title">Valor por Categoria</div><table><tr><th>Categoria</th><th style="text-align:right">Produtos</th><th style="text-align:right">Qtd Total</th><th style="text-align:right">Valor</th></tr>`;
        categoryBreakdown.forEach((item) => {
          body += `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.category.color};margin-right:6px;vertical-align:middle"></span>${item.category.name}</td><td style="text-align:right">${item.productCount}</td><td style="text-align:right">${item.totalQty}</td><td style="text-align:right">${formatCurrency(item.totalVal)}</td></tr>`;
        });
        body += `</table>`;
      }
    } else {
      const criticalItems = consumptionData.filter((c) => c.status === "critical");
      const warningItems = consumptionData.filter((c) => c.status === "warning");
      const totalMonthlyCost = consumptionData.reduce((a, c) => a + c.costProjection, 0);

      body += `<div class="summary-box">
        <div class="summary-item"><div class="value">${consumptionData.length}</div><div class="label">Materiais Consumidos</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(totalMonthlyCost)}</div><div class="label">Projeção Mensal</div></div>
      </div>`;

      if (criticalItems.length > 0 || warningItems.length > 0) {
        body += `<div style="background:#FEF2F2;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:11px;color:#DC2626">`;
        if (criticalItems.length > 0) body += `${criticalItems.length} material(is) acabam em menos de 7 dias`;
        if (criticalItems.length > 0 && warningItems.length > 0) body += ` | `;
        if (warningItems.length > 0) body += `${warningItems.length} em até 30 dias`;
        body += `</div>`;
      }

      if (consumptionData.length > 0) {
        body += `<div class="section-title">Análise por Material</div>
        <table><tr><th>Material</th><th>Categoria</th><th style="text-align:right">Consumido</th><th style="text-align:right">Média/dia</th><th style="text-align:right">Proj./mês</th><th style="text-align:right">Estoque</th><th style="text-align:right">Dias restantes</th><th>Status</th></tr>`;
        consumptionData.forEach((item) => {
          const badge = item.status === "critical" ? "badge-critical" : item.status === "warning" ? "badge-warning" : "badge-ok";
          const statusLabel = item.status === "critical" ? "Crítico" : item.status === "warning" ? "Atenção" : "OK";
          body += `<tr><td>${item.product.name}</td><td>${item.category?.name ?? "-"}</td><td style="text-align:right">${item.totalConsumed}</td><td style="text-align:right">${item.dailyAvg.toFixed(1)}</td><td style="text-align:right">${Math.round(item.monthlyProjection)}</td><td style="text-align:right">${item.product.quantity}</td><td style="text-align:right">${item.daysUntilEmpty ?? "-"}</td><td><span class="badge ${badge}">${statusLabel}</span></td></tr>`;
        });
        body += `</table>`;
      } else {
        body += `<p>Sem dados de consumo no período.</p>`;
      }
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório MTEC ENERGIA</title>${css}</head><body>
      <div class="header">
        <h1>MTEC ENERGIA</h1>
        <h2>Relatório de ${tabLabel}</h2>
        <div class="meta">Período: ${periodLabel} | ${filterNote} | Gerado em: ${dateStr}</div>
      </div>
      ${body}
      <div class="footer">MTEC ENERGIA - Sistema de Controle de Estoque - ${dateStr}</div>
    </body></html>`;
  };

  const handlePrint = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const html = buildPrintHtml();

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 300);
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível imprimir o relatório.");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.companyTag}>MTEC ENERGIA</Text>
          <Pressable
            onPress={handlePrint}
            style={({ pressed }) => [styles.printBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="print-outline" size={18} color={Colors.primary} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
          {TAB_CONFIG.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tabBtn, tab === t.key && { backgroundColor: t.color, borderColor: t.color }]}
            >
              <Ionicons name={t.icon} size={16} color={tab === t.key ? Colors.white : t.color} />
              <Text style={[styles.tabText, tab === t.key && { color: Colors.white }]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.controlsRow}>
          <View style={styles.periodRow}>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.periodBtn, period === p && styles.periodBtnActive]}>
                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{PERIOD_LABELS[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => setFilterVisible(true)}
            style={({ pressed }) => [styles.filterBtn, selectedProductIds.length > 0 && styles.filterBtnActive, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="filter" size={16} color={selectedProductIds.length > 0 ? Colors.white : Colors.primary} />
            <Text style={[styles.filterText, selectedProductIds.length > 0 && { color: Colors.white }]}>
              {selectedProductIds.length > 0 ? `${selectedProductIds.length} selecionado(s)` : "Filtrar"}
            </Text>
          </Pressable>
        </View>

        {renderContent()}

        <View style={{ height: Platform.OS === "web" ? 34 : 40 }} />
      </ScrollView>

      <Modal visible={filterVisible} animationType="slide" transparent onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por Produto</Text>
              <Pressable onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            {selectedProductIds.length > 0 && (
              <Pressable onPress={clearFilters} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}>
                <Ionicons name="close-circle" size={16} color={Colors.danger} />
                <Text style={styles.clearBtnText}>Limpar filtros</Text>
              </Pressable>
            )}

            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              style={styles.filterList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = selectedProductIds.includes(item.id);
                const cat = categories.find((c) => c.id === item.categoryId);
                return (
                  <Pressable
                    onPress={() => toggleProduct(item.id)}
                    style={[styles.filterItem, selected && styles.filterItemSelected]}
                  >
                    <View style={styles.filterItemLeft}>
                      {cat && <View style={[styles.catDot, { backgroundColor: cat.color }]} />}
                      <View>
                        <Text style={styles.filterItemName}>{item.name}</Text>
                        <Text style={styles.filterItemMeta}>{cat?.name ?? "Sem categoria"} - {item.quantity} un.</Text>
                      </View>
                    </View>
                    <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                      {selected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
                </View>
              }
            />

            <Pressable
              onPress={() => setFilterVisible(false)}
              style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="checkmark" size={18} color={Colors.white} />
              <Text style={styles.applyBtnText}>Aplicar</Text>
            </Pressable>
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
  companyTag: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  tabScroll: {
    marginBottom: 16,
    flexGrow: 0,
  },
  tabRow: {
    gap: 8,
    paddingRight: 4,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  controlsRow: {
    gap: 10,
    marginBottom: 20,
  },
  periodRow: {
    flexDirection: "row",
    gap: 6,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
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
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  periodTextActive: {
    color: Colors.white,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  summaryPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
  },
  summaryPillValue: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  summaryPillLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    width: 90,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  barTrack: {
    flex: 1,
    height: 20,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
    minWidth: 4,
  },
  barValue: {
    width: 60,
    textAlign: "right" as const,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  listCard: {
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
    gap: 10,
  },
  movDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  movInfo: {
    flex: 1,
  },
  movName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  movMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  movRight: {
    alignItems: "flex-end",
  },
  movQty: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  movVal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  overviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  overviewLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  overviewValueText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  alertBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.danger,
  },
  consumptionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  consumptionCritical: {
    borderColor: "#FECACA",
    backgroundColor: "#FFFBFB",
  },
  consumptionWarning: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFDF5",
  },
  consumptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  consumptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  consumptionName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeCritical: {
    backgroundColor: Colors.dangerLight,
  },
  badgeWarning: {
    backgroundColor: "#FEF3C7",
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  consumptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  consumptionStat: {
    width: "50%" as any,
    paddingVertical: 6,
  },
  consumptionStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  consumptionStatValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 2,
  },
  consumptionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  consumptionFooterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  consumptionFooterText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  emptySubText: {
    fontSize: 13,
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
    maxHeight: "75%",
    paddingBottom: Platform.OS === "web" ? 34 : 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  clearBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.danger,
  },
  filterList: {
    maxHeight: 350,
  },
  filterItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  filterItemSelected: {
    backgroundColor: "#E0F2F1",
  },
  filterItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  filterItemName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  filterItemMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    marginTop: 12,
  },
  applyBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
