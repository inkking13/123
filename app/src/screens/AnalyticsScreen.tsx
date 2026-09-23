import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { GhostLink } from '../components/Buttons';
import { ProgressBar } from '../components/ProgressBar';
import { useEngineVersion } from '../engine/useEngine';

const CHART_W = 300;
const CHART_H = 64;

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return (
      <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: font.regular }}>
          Пока недостаточно данных — сходите в поход
        </Text>
      </View>
    );
  }
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const stepX = CHART_W / (data.length - 1);
  const pad = 8;
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / range) * (CHART_H - pad * 2);
    return { x, y };
  });
  const linePath = 'M ' + pts.map((p) => `${p.x},${p.y}`).join(' L ');
  const areaPath = `${linePath} L ${CHART_W},${CHART_H} L 0,${CHART_H} Z`;
  const last = pts[pts.length - 1];
  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
      <Path d={areaPath} fill={color} fillOpacity={0.12} />
      <Path d={linePath} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
    </Svg>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 }}>
      <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>{label}</Text>
      <Text style={{ fontSize: 17, fontFamily: font.medium, color: colors.text, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function BreakdownRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: font.regular }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.text, fontFamily: font.medium }}>{count}</Text>
      </View>
      <ProgressBar pct={max ? (count / max) * 100 : 0} color={color} height={6} />
    </View>
  );
}

export function AnalyticsScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const a = engine.analyticsVM();
  const maxOutcome = Math.max(a.roomWins, a.bossWins, a.wipes, 1);
  const goldSeries = a.history.map((h) => h.gold);
  const moraleSeries = a.history.map((h) => h.avgMorale);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 40 }}>
        <GhostLink label="Лагерь" icon="arrow-left" onPress={() => engine.go('home')} />
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, marginTop: 10, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, marginTop: 4, marginBottom: 18, letterSpacing: -0.5 }}>Аналитика гильдии</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <StatTile label="Win rate" value={a.winRatePct == null ? '—' : `${a.winRatePct}%`} />
          <StatTile label="Всего боёв" value={String(a.totalFights)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22 }}>
          <StatTile label="KPI выполнено" value={`${a.kpiDone}/${a.kpiTotal}`} />
          <StatTile label="Ср. мораль" value={`${a.avgMorale}%`} />
        </View>

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 4, fontFamily: font.regular }}>Бюджет гильдии</Text>
        <Text style={{ fontSize: 20, fontFamily: font.medium, color: colors.warn, marginBottom: 8 }}>{a.gold} золота</Text>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 22 }}>
          <Sparkline data={goldSeries} color={colors.warn} />
        </View>

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 4, fontFamily: font.regular }}>Средняя мораль</Text>
        <Text style={{ fontSize: 20, fontFamily: font.medium, color: colors.good, marginBottom: 8 }}>{a.avgMorale}%</Text>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 22 }}>
          <Sparkline data={moraleSeries} color={colors.good} />
        </View>

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 12, fontFamily: font.regular }}>Исход операций</Text>
        <BreakdownRow label="Комнаты зачищены" count={a.roomWins} max={maxOutcome} color={colors.good} />
        <BreakdownRow label="Боссы повержены" count={a.bossWins} max={maxOutcome} color={colors.accent} />
        <BreakdownRow label="Вайпы" count={a.wipes} max={maxOutcome} color={colors.danger} />
      </ScrollView>
    </View>
  );
}
