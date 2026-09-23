import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { DUNGEONS, LOCATIONS } from '../data/dungeons';
import { colors, font } from '../theme/theme';
import { Icon, IconName } from '../components/Icon';
import { TabBar, TAB_BAR_CONTENT_HEIGHT } from '../components/TabBar';
import { useEngineVersion } from '../engine/useEngine';

const DUNGEON_ICON: Record<string, IconName> = {
  wastes: 'trash-simple', road: 'path', groblot: 'skull',
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
const VBOX_H = 600;
const NODE_R = 30;
// Bottom-to-top zigzag within a location: its first (easiest) dungeon sits at
// the bottom, matching how mobile campaign maps read as "climb upward".
const NODE_POS = [
  { x: 90, y: 500 },
  { x: 210, y: 300 },
  { x: 90, y: 100 },
];

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + 32 }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 30, fontFamily: font.medium, color: colors.text, marginTop: 4, letterSpacing: -0.6 }}>Карта уровней</Text>
        <Text style={{ fontSize: 13, color: colors.textDim, marginTop: 4, marginBottom: 18, fontFamily: font.regular }}>
          Восемь земель гильдии, по три командировки в каждой — от разминки до самого верха. Каждая открывается победой над предыдущей.
        </Text>

        {groups.map(({ loc, nodes, pathD }, gi) => {
          const locUnlocked = nodes.some((n) => n.unlocked);
          return (
            <View key={loc.id} style={{ marginBottom: 28 }}>
              <Text style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: locUnlocked ? colors.accent : colors.textFaint, fontFamily: font.medium }}>
                {gi + 1}. {loc.name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 3, marginBottom: 14, fontFamily: font.regular }}>{loc.desc}</Text>

              <View style={{ width: '100%', aspectRatio: VBOX_W / VBOX_H }}>
                <Svg width="100%" height="100%" viewBox={`0 0 ${VBOX_W} ${VBOX_H}`} style={{ position: 'absolute' }}>
                  {pathD.map((d, i) => (
                    <Path
                      key={i}
                      d={d}
                      stroke={nodes[i].cleared ? colors.good : colors.border}
                      strokeWidth={4}
                      strokeDasharray={nodes[i].cleared ? undefined : '2 10'}
                      strokeLinecap="round"
                      fill="none"
                    />
                  ))}
                </Svg>

                {nodes.map((n) => {
                  const leftPct = (n.pos.x / VBOX_W) * 100;
                  const topPct = (n.pos.y / VBOX_H) * 100;
                  const ringColor = n.cleared ? colors.good : n.unlocked ? colors.danger : colors.border;
                  const iconColor = n.cleared ? colors.good : n.unlocked ? colors.danger : colors.borderHover;
                  return (
                    <Pressable
                      key={n.dungeon.id}
                      onPress={() => onTapNode(n.dungeon.id, n.unlocked)}
                      style={{ position: 'absolute', left: `${leftPct}%`, top: `${topPct}%`, transform: [{ translateX: -50 }, { translateY: -NODE_R - 4 }], width: 100, alignItems: 'center' }}
                    >
                      <View
                        style={{
                          width: NODE_R * 2, height: NODE_R * 2, borderRadius: NODE_R, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: n.unlocked ? colors.surface : colors.bgAlt,
                          borderWidth: 2, borderColor: ringColor, opacity: n.unlocked ? 1 : 0.7,
                        }}
                      >
                        {n.unlocked ? (
                          <Icon name={n.cleared ? 'check' : DUNGEON_ICON[n.dungeon.id]} size={24} color={iconColor} weight={n.cleared ? 'fill' : 'regular'} />
                        ) : (
                          <Icon name="lock-simple" size={20} color={colors.borderHover} />
                        )}
                      </View>
                      <Text numberOfLines={2} style={{ marginTop: 8, fontSize: 11.5, textAlign: 'center', color: n.unlocked ? colors.text : colors.borderHover, fontFamily: font.medium }}>
                        {n.dungeon.name}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 10, textAlign: 'center', color: colors.textFaint, fontFamily: font.regular }}>
                        {n.unlocked ? `реком. ГС ${n.dungeon.recommendedGs}` : 'закрыто'}
                      </Text>
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
