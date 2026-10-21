import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ImageBackground, Pressable, ScrollView, Text, View } from 'react-native';
import { BATTLE_THEMES } from '../components/BattleBackdrop';
import Svg, { G, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { DUNGEONS, LOCATIONS } from '../data/dungeons';
import { colors, font, ink } from '../theme/theme';
import { Icon, IconName } from '../components/Icon';
import { TabBar, TAB_BAR_CONTENT_HEIGHT } from '../components/TabBar';
import { useEngineVersion } from '../engine/useEngine';
import { PAPER, ScreenTitle, WaxSeal } from '../components/Frame';

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

// Ink sketches scattered over each land's sheet, clear of the nodes and their labels.
type Sketch = 'peak' | 'tree' | 'hills';
const SKETCHES: { x: number; y: number; k: Sketch; s: number }[] = [
  { x: 235, y: 70, k: 'peak', s: 1.1 }, { x: 268, y: 92, k: 'peak', s: 0.8 }, { x: 40, y: 200, k: 'tree', s: 1 },
  { x: 58, y: 222, k: 'tree', s: 0.8 }, { x: 250, y: 380, k: 'hills', s: 1 }, { x: 165, y: 150, k: 'hills', s: 0.8 },
  { x: 30, y: 440, k: 'peak', s: 0.7 }, { x: 270, y: 300, k: 'tree', s: 0.9 }, { x: 175, y: 430, k: 'tree', s: 0.75 },
];

function sketchPath(k: Sketch): string {
  switch (k) {
    // A peak with its shaded flank hatched in.
    case 'peak': return 'M -16 10 L 0 -14 L 16 10 M 0 -14 L 4 -2 L 2 4 L 7 10 M 4 -4 L 9 2 M 6 -8 L 12 0';
    case 'tree': return 'M 0 10 L 0 0 M -7 2 Q -9 -10 0 -13 Q 9 -10 7 2 Q 0 5 -7 2';
    case 'hills': return 'M -20 6 Q -10 -6 0 6 Q 8 -2 18 6';
  }
}

/** The node the party should go to next: an ink ring breathing round it. */
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
        position: 'absolute', width: NODE_R * 2 + 8, height: NODE_R * 2 + 8, borderRadius: NODE_R + 4, borderWidth: 2, borderColor: ink.wax,
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
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.accent, fontFamily: font.medium }}>Отдел кадров</Text>
        <ScreenTitle style={{ marginTop: 4 }}>Карта походов</ScreenTitle>
        <Text style={{ fontSize: 13, color: colors.textDim, marginTop: 4, marginBottom: 18, fontFamily: font.regular }}>
          Восемь земель гильдии, по три командировки в каждой — от разминки до самого верха. Каждая открывается победой над предыдущей.
        </Text>

        {groups.map(({ loc, nodes, pathD }, gi) => {
          const locUnlocked = nodes.some((n) => n.unlocked);
          const theme = BATTLE_THEMES[loc.id] ?? BATTLE_THEMES.outskirts;
          return (
            <View key={loc.id} style={{ marginBottom: 28 }}>
              <Text style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: locUnlocked ? colors.accent : colors.textFaint, fontFamily: font.medium }}>
                {gi + 1}. {loc.name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 3, marginBottom: 14, fontFamily: font.regular }}>{loc.desc}</Text>

              {/* Each land is a sheet of the campaign map: parchment washed faintly in the land's
                  colour, with ink sketches and the road between its dungeons. */}
              <ImageBackground
                source={PAPER} resizeMode="stretch" imageStyle={{ borderRadius: 3 }}
                style={{ width: '100%', aspectRatio: VBOX_W / VBOX_H, borderRadius: 3, overflow: 'hidden', opacity: locUnlocked ? 1 : 0.55 }}
              >
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: theme.sky[1], opacity: 0.1 }} />
                <Svg width="100%" height="100%" viewBox={`0 0 ${VBOX_W} ${VBOX_H}`} style={{ position: 'absolute' }}>
                  {SKETCHES.map((k, i) => (
                    <G key={i} transform={`translate(${k.x} ${k.y}) scale(${k.s})`}>
                      <Path d={sketchPath(k.k)} stroke={ink.muted} strokeOpacity={0.55} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </G>
                  ))}
                  {pathD.map((d, i) => (
                    <Path
                      key={i}
                      d={d}
                      stroke={nodes[i].cleared ? ink.text : nodes[i + 1].unlocked ? ink.red : ink.faint}
                      strokeOpacity={nodes[i].cleared || nodes[i + 1].unlocked ? 0.85 : 0.5}
                      strokeWidth={2.5}
                      strokeDasharray={nodes[i].cleared ? undefined : '6 7'}
                      strokeLinecap="round"
                      fill="none"
                    />
                  ))}
                </Svg>

                {nodes.map((n) => {
                  const leftPct = (n.pos.x / VBOX_W) * 100;
                  const topPct = (n.pos.y / VBOX_H) * 100;
                  const here = n.dungeon.id === current;
                  const iconColor = n.cleared ? ink.green : n.unlocked ? ink.red : ink.faint;
                  return (
                    <Pressable
                      key={n.dungeon.id}
                      onPress={() => onTapNode(n.dungeon.id, n.unlocked)}
                      style={{ position: 'absolute', left: `${leftPct}%`, top: `${topPct}%`, transform: [{ translateX: -50 }, { translateY: -NODE_R - 4 }], width: 100, alignItems: 'center' }}
                    >
                      {here ? <View style={{ position: 'absolute', top: -4, width: NODE_R * 2 + 8, height: NODE_R * 2 + 8, alignItems: 'center', justifyContent: 'center' }}><Pulse /></View> : null}
                      {here ? (
                        <View style={{ width: NODE_R * 2, height: NODE_R * 2, alignItems: 'center', justifyContent: 'center' }}>
                          <WaxSeal size={NODE_R * 2 - 4}><Icon name={DUNGEON_ICON[n.dungeon.id]} size={24} color="#f3dcc0" weight="fill" /></WaxSeal>
                        </View>
                      ) : (
                        <View
                          style={{
                            width: NODE_R * 2, height: NODE_R * 2, borderRadius: NODE_R, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: 'rgba(246,234,206,0.55)', borderWidth: 2, borderColor: n.unlocked ? ink.text : ink.faint, borderStyle: n.unlocked ? 'solid' : 'dashed',
                          }}
                        >
                          {n.unlocked ? (
                            <Icon name={n.cleared ? 'check' : DUNGEON_ICON[n.dungeon.id]} size={24} color={iconColor} weight={n.cleared ? 'fill' : 'regular'} />
                          ) : (
                            <Icon name="lock-simple" size={20} color={ink.faint} />
                          )}
                        </View>
                      )}
                      {here ? <Text style={{ marginTop: 5, fontSize: 11, letterSpacing: 1, color: ink.red, fontFamily: font.title }}>Вы здесь</Text> : null}
                      <View style={{ marginTop: here ? 1 : 5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(236,222,190,0.82)' }}>
                        <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 16, textAlign: 'center', color: n.unlocked ? ink.text : ink.faint, fontFamily: font.title }}>
                          {n.dungeon.name}
                        </Text>
                        <Text style={{ marginTop: 1, fontSize: 11.5, textAlign: 'center', color: ink.muted, fontFamily: font.italic }}>
                          {n.unlocked ? `реком. ГС ${n.dungeon.recommendedGs}` : 'закрыто'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ImageBackground>
            </View>
          );
        })}
      </ScrollView>
      <TabBar engine={engine} />
    </View>
  );
}
