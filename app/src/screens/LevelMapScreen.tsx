import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BATTLE_THEMES, BattleBackdrop } from '../components/BattleBackdrop';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { DUNGEONS, LOCATIONS } from '../data/dungeons';
import { colors, font } from '../theme/theme';
import { Icon, IconName } from '../components/Icon';
import { TabBar, TAB_BAR_CONTENT_HEIGHT } from '../components/TabBar';
import { useEngineVersion } from '../engine/useEngine';

const DUNGEON_ICON: Record<string, IconName> = {
  wastes: 'skull', road: 'path', groblot: 'skull',
  frostpass: 'drop', wolfrifts: 'target', icepeaks: 'snowflake',
  charfields: 'flame', parishruins: 'campfire', ashen: 'fire',
  mortgagedfarms: 'scroll', debtorsjail: 'shield-chevron', mines: 'coins',
  blackmarket: 'storefront', smugglercatacombs: 'path', nightsyndicate: 'sword',
  unmarkedgraves: 'skull', desertersfort: 'shield', deadlegion: 'users-three',
  burntcliffs: 'flame', wyvernlair: 'target', ancientpeak: 'fire',
  shareholderfloor: 'chart-line-up', councilantechamber: 'identification-card', boardroom: 'crown-simple',
};

// Virtual coordinate space each location's 3-node zigzag is authored in. The
// wrapper below is forced to this exact aspect ratio, so percentage-based
// node positions line up with the SVG path underneath regardless of screen width.
const VBOX_W = 300;
const VBOX_H = 460;
const NODE_R = 30;
// Bottom-to-top zigzag within a location: its first (easiest) dungeon sits at
// the bottom, matching how mobile campaign maps read as "climb upward".
const NODE_POS = [
  { x: 90, y: 365 },
  { x: 210, y: 235 },
  { x: 90, y: 75 },
];

/** The node the party should go to next: a gold ring breathing round it. */
function Pulse() {
  const k = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(k, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    a.start(); return () => a.stop();
  }, [k]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: NODE_R * 2 + 8, height: NODE_R * 2 + 8, borderRadius: NODE_R + 4, borderWidth: 2, borderColor: '#e2bf85',
        opacity: k.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scale: k.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
      }}
    />
  );
}

export function LevelMapScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const ready = engine.squadReady();

  const onTapNode = (id: string, unlocked: boolean) => {
    if (!unlocked) return;
    engine.selectDungeon(id);
    if (ready) engine.goDungeon(); else engine.go('roster');
  };

  const [w, setW] = useState(0);
  const still = useMemo(() => new Animated.Value(0), []);
  const groups = LOCATIONS.map((loc) => {
    const dungeons = DUNGEONS.filter((d) => d.locationId === loc.id);
    const nodes = dungeons.map((d, i) => ({
      dungeon: d,
      pos: NODE_POS[i] || NODE_POS[NODE_POS.length - 1],
      unlocked: engine.isDungeonUnlocked(d.id),
      cleared: engine.defeatedDungeons.has(d.id),
    }));
    const pathD = nodes.slice(1).map((n, i) => {
      const a = nodes[i].pos, b = n.pos;
      const midY = (a.y + b.y) / 2;
      return `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
    });
    return { loc, nodes, pathD };
  });
  // The furthest dungeon open but not yet beaten: "you are here".
  const current = groups.flatMap((g) => g.nodes).filter((n) => n.unlocked && !n.cleared).map((n) => n.dungeon.id)[0];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + 32 }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 30, fontFamily: font.medium, color: colors.text, marginTop: 4, letterSpacing: -0.6 }}>Карта походов</Text>
        <Text style={{ fontSize: 13, color: colors.textDim, marginTop: 4, marginBottom: 18, fontFamily: font.regular }}>
          Восемь земель гильдии, по три командировки в каждой — от разминки до самого верха. Каждая открывается победой над предыдущей.
        </Text>

        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} />
        {groups.map(({ loc, nodes, pathD }, gi) => {
          const locUnlocked = nodes.some((n) => n.unlocked);
          const theme = BATTLE_THEMES[loc.id] ?? BATTLE_THEMES.outskirts;
          const h = w * VBOX_H / VBOX_W;
          return (
            <View key={loc.id} style={{ marginBottom: 28 }}>
              <Text style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: locUnlocked ? colors.accent : colors.textFaint, fontFamily: font.medium }}>
                {gi + 1}. {loc.name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 3, marginBottom: 14, fontFamily: font.regular }}>{loc.desc}</Text>

              <View style={{ width: '100%', aspectRatio: VBOX_W / VBOX_H, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: locUnlocked ? colors.borderStrong : colors.border }}>
                {w ? (
                  <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: locUnlocked ? 1 : 0.35 }}>
                    <BattleBackdrop theme={theme} width={w} height={h} horizon={h * 0.42} pan={still} />
                    <LinearGradient colors={['rgba(15,17,25,0)', 'rgba(15,17,25,0.55)', 'rgba(15,17,25,0.85)']} locations={[0, 0.5, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
                  </View>
                ) : null}
                <Svg width="100%" height="100%" viewBox={`0 0 ${VBOX_W} ${VBOX_H}`} style={{ position: 'absolute' }}>
                  {pathD.map((d, i) => (
                    <Path
                      key={i}
                      d={d}
                      stroke={nodes[i].cleared ? colors.good : nodes[i + 1].unlocked ? colors.accent : 'rgba(233,233,237,0.25)'}
                      strokeWidth={5}
                      strokeDasharray={nodes[i].cleared ? undefined : '2 10'}
                      strokeLinecap="round"
                      fill="none"
                    />
                  ))}
                </Svg>

                {nodes.map((n) => {
                  const leftPct = (n.pos.x / VBOX_W) * 100;
                  const topPct = (n.pos.y / VBOX_H) * 100;
                  const here = n.dungeon.id === current;
                  const ringColor = n.cleared ? colors.good : here ? '#e2bf85' : n.unlocked ? colors.danger : colors.border;
                  const iconColor = n.cleared ? colors.good : n.unlocked ? colors.danger : colors.borderHover;
                  return (
                    <Pressable
                      key={n.dungeon.id}
                      onPress={() => onTapNode(n.dungeon.id, n.unlocked)}
                      style={{ position: 'absolute', left: `${leftPct}%`, top: `${topPct}%`, transform: [{ translateX: -50 }, { translateY: -NODE_R - 4 }], width: 100, alignItems: 'center' }}
                    >
                      {here ? <View style={{ position: 'absolute', top: -4, width: NODE_R * 2 + 8, height: NODE_R * 2 + 8, alignItems: 'center', justifyContent: 'center' }}><Pulse /></View> : null}
                      <View
                        style={{
                          width: NODE_R * 2, height: NODE_R * 2, borderRadius: NODE_R, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: n.unlocked ? '#181511' : '#0f1119',
                          borderWidth: 2, borderColor: ringColor, opacity: n.unlocked ? 1 : 0.7,
                        }}
                      >
                        {n.unlocked ? (
                          <Icon name={n.cleared ? 'check' : DUNGEON_ICON[n.dungeon.id]} size={24} color={iconColor} weight={n.cleared ? 'fill' : 'regular'} />
                        ) : (
                          <Icon name="lock-simple" size={20} color={colors.borderHover} />
                        )}
                      </View>
                      {here ? <Text style={{ marginTop: 6, fontSize: 9.5, letterSpacing: 1.4, color: '#e2bf85', fontFamily: font.semibold }}>ВЫ ЗДЕСЬ</Text> : null}
                      <View style={{ marginTop: here ? 2 : 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(15,17,25,0.72)' }}>
                        <Text numberOfLines={2} style={{ fontSize: 11.5, textAlign: 'center', color: n.unlocked ? colors.text : colors.borderHover, fontFamily: font.medium, textShadowColor: '#000', textShadowRadius: 4 }}>
                          {n.dungeon.name}
                        </Text>
                        <Text style={{ marginTop: 2, fontSize: 10, textAlign: 'center', color: colors.textFaint, fontFamily: font.regular }}>
                          {n.unlocked ? `реком. ГС ${n.dungeon.recommendedGs}` : 'закрыто'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <TabBar engine={engine} />
    </View>
  );
}
