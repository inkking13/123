import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EquipItemVM, EquipSlotVM, GameEngine } from '../engine/GameEngine';
import { Candidate, GearSlotKey } from '../data/types';
import { RARITY_COLOR, RARITY_NAME, SET_COLOR, SLOT_SILHOUETTE, StatLine } from '../data/gearInfo';
import { colors, font, roleColor } from '../theme/theme';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import { HeroPreview3D } from '../battle3d/HeroPreview3D';
import { canRender3D } from '../battle3d/Battle3D';

const GOLD = '#8a7650';
const GOLD_DIM = '#4a3f2c';
const PANEL_BG = '#12100d';
const CELL_BG = '#1a1712';

// Diablo IV layout: worn pieces down the left, jewellery and boots on the
// right, the weapon under the portrait.
const LEFT: GearSlotKey[] = ['helm', 'armor', 'gloves'];
const RIGHT: GearSlotKey[] = ['trinket', 'ring', 'boots'];

// Small rotated square used as the frame's corner rivet / title flourish.
function Rivet({ style }: { style: object }) {
  return <View style={[{ position: 'absolute', width: 8, height: 8, transform: [{ rotate: '45deg' }], backgroundColor: GOLD, borderWidth: 1, borderColor: PANEL_BG }, style]} />;
}

function SlotCell({ slot, item, w, h, active, onPress }: { slot: GearSlotKey; item: EquipItemVM | null; w: number; h: number; active: boolean; onPress: () => void }) {
  const tint = item ? RARITY_COLOR[item.rarity] : GOLD_DIM;
  const iconSize = Math.min(w, h) - 14;
  return (
    <Pressable testID={`paperdoll-${slot}`} onPress={onPress} style={{ width: w, height: h }}>
      <View style={{
        flex: 1, borderWidth: active ? 2 : 1.5, borderColor: active ? '#f1e3c0' : tint, borderRadius: 4,
        backgroundColor: CELL_BG, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {item ? (
          <>
            <LinearGradient colors={['rgba(0,0,0,0)', tint + '55']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' }} />
            <ItemIcon id={item.icon} size={iconSize} radius={3} />
          </>
        ) : (
          <View style={{ opacity: 0.35 }}>
            <Icon name={SLOT_SILHOUETTE[slot]} size={Math.round(iconSize * 0.5)} color={GOLD} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function StashCell({ item, active, onPress }: { item: EquipItemVM; active: boolean; onPress: () => void }) {
  const tint = RARITY_COLOR[item.rarity];
  const blocked = !item.available;
  return (
    <Pressable testID={`stash-${item.id}`} onPress={onPress} style={{ width: 56, height: 56 }}>
      <View style={{
        flex: 1, borderRadius: 4, borderWidth: active ? 2 : 1, borderColor: active ? '#f1e3c0' : tint + (blocked ? '66' : 'cc'),
        backgroundColor: CELL_BG, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', opacity: blocked ? 0.5 : 1,
      }}>
        <LinearGradient colors={['rgba(0,0,0,0)', tint + '40']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }} />
        <ItemIcon id={item.icon} size={44} radius={3} />
        {item.worn ? (
          <View style={{ position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.good, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={9} color={PANEL_BG} />
          </View>
        ) : null}
        {item.free > 0 ? (
          <Text style={{ position: 'absolute', right: 3, bottom: 1, fontSize: 10, fontFamily: font.bold, color: '#f1e3c0', textShadowColor: '#000', textShadowRadius: 3 }}>{item.free}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Lines({ lines }: { lines: StatLine[] }) {
  return (
    <>
      {lines.map((l) => (
        <Text key={l.text} style={{ fontSize: 12.5, lineHeight: 18, color: l.good ? '#9fd4a8' : '#e0857a', fontFamily: font.regular }}>{l.text}</Text>
      ))}
    </>
  );
}

function Tooltip({ slot, item }: { slot: EquipSlotVM; item: EquipItemVM }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [item.id, anim]);
  const tint = RARITY_COLOR[item.rarity];
  const status = item.worn
    ? 'Надето'
    : item.available
      ? `В тайнике: ${item.free}`
      : `Всё занято: ${item.wornBy.join(', ')}`;
  return (
    <Animated.View
      testID="item-tooltip"
      style={{
        marginTop: 12, borderWidth: 1, borderColor: tint + '99', borderTopWidth: 3, borderTopColor: tint, borderRadius: 4,
        backgroundColor: '#0d0c0a', padding: 12,
        opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ borderWidth: 1, borderColor: tint, borderRadius: 4, padding: 2 }}>
          <ItemIcon id={item.icon} size={52} radius={3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: font.semibold, color: tint, letterSpacing: -0.2 }}>{item.name}</Text>
          <Text style={{ fontSize: 11.5, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>
            {RARITY_NAME[item.rarity]} · {slot.label}
          </Text>
          {item.setName ? <Text style={{ fontSize: 11.5, color: SET_COLOR, marginTop: 2, fontFamily: font.regular }}>Комплект: {item.setName}</Text> : null}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: GOLD_DIM, marginVertical: 9 }} />
      {item.stats.length ? <Lines lines={item.stats} /> : <Text style={{ fontSize: 12.5, color: colors.textFaint, fontFamily: font.regular }}>Без характеристик</Text>}
      {item.compare.length ? (
        <>
          <Text style={{ fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textFaint, marginTop: 9, marginBottom: 3, fontFamily: font.regular }}>
            {slot.equipped ? 'Против надетого' : 'Против пустого слота'}
          </Text>
          <Lines lines={item.compare} />
        </>
      ) : null}
      <Text style={{ fontSize: 11.5, color: colors.textDim, fontStyle: 'italic', marginTop: 9, lineHeight: 16, fontFamily: font.regular }}>{item.desc}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11, gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 11.5, color: item.available || item.worn ? colors.textFaint : colors.danger, fontFamily: font.regular }}>{status}</Text>
        {item.worn ? (
          <Pressable testID="unequip" onPress={slot.onUnequip} style={{ paddingHorizontal: 14, height: 34, borderRadius: 4, borderWidth: 1, borderColor: GOLD, justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, fontFamily: font.medium, color: '#e6d6b0' }}>Снять</Text>
          </Pressable>
        ) : (
          <Pressable
            testID="equip"
            onPress={item.onEquip}
            disabled={!item.available}
            style={{ paddingHorizontal: 16, height: 34, borderRadius: 4, backgroundColor: item.available ? '#a3884f' : '#3a3428', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 13, fontFamily: font.semibold, color: item.available ? '#15120c' : colors.textFaint }}>Надеть</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// Diablo IV-style character sheet: the hero framed in the middle, gear cells
// around them, the guild stash for the tapped slot as a grid of cells and a
// rarity-coloured tooltip comparing the picked piece against the worn one.
export function EquipmentPanel({ engine, c }: { engine: GameEngine; c: Candidate }) {
  const vm = engine.equipmentVM(c);
  const [slotKey, setSlotKey] = useState<GearSlotKey>('weapon');
  const [itemId, setItemId] = useState<string | null>(null);
  const slot = vm.slots.find((s) => s.slot === slotKey) || vm.slots[0];
  const by = (k: GearSlotKey) => vm.slots.find((s) => s.slot === k)!;
  const picked = slot.stash.find((i) => i.id === itemId) || slot.equipped || slot.stash[0] || null;

  const [failed3d, setFailed3d] = useState(false);
  const show3d = useMemo(() => engine.settings.view3d && canRender3D(), [engine.settings.view3d]) && !failed3d;
  const pickSlot = (k: GearSlotKey) => { setSlotKey(k); setItemId(null); };
  const cell = (k: GearSlotKey, w = 62, h = 62) => (
    <View key={k} style={{ alignItems: 'center', gap: 2 }}>
      <SlotCell slot={k} item={by(k).equipped} w={w} h={h} active={slotKey === k} onPress={() => pickSlot(k)} />
      <Text style={{ fontSize: 9.5, color: '#a8966c', fontFamily: font.regular }}>{by(k).label}</Text>
    </View>
  );

  return (
    <View style={{ borderWidth: 1, borderColor: GOLD, borderRadius: 6, backgroundColor: PANEL_BG, padding: 12, marginBottom: 18 }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1, borderColor: GOLD_DIM, borderRadius: 4 }} />
      <Rivet style={{ top: -4, left: -4 }} />
      <Rivet style={{ top: -4, right: -4 }} />
      <Rivet style={{ bottom: -4, left: -4 }} />
      <Rivet style={{ bottom: -4, right: -4 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <LinearGradient colors={['rgba(138,118,80,0)', GOLD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
        <Text style={{ fontSize: 12, letterSpacing: 2.4, color: '#d9c595', fontFamily: font.semibold }}>СНАРЯЖЕНИЕ</Text>
        <LinearGradient colors={[GOLD, 'rgba(138,118,80,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 10 }}>
        <View style={{ gap: 6 }}>
          {LEFT.map((k) => cell(k))}
        </View>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ width: 132, height: 172, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: GOLD_DIM }}>
            {show3d ? (
              <HeroPreview3D id={c.id} width={132} height={172} onFail={() => setFailed3d(true)} />
            ) : (
              <Avatar id={c.id} size={172} radius={0} style={{ width: 132, height: 172 }} />
            )}
            <LinearGradient pointerEvents="none" colors={['rgba(18,16,13,0.1)', 'rgba(18,16,13,0)', 'rgba(18,16,13,0.95)']} locations={[0, 0.5, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 6, right: 6, bottom: 6, alignItems: 'center' }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.semibold, color: '#efe4c8' }}>{c.name}</Text>
              <Text style={{ fontSize: 10, color: roleColor[c.role], fontFamily: font.regular }}>Ур. {c.level}</Text>
            </View>
          </View>
          {cell('weapon', 132, 58)}
        </View>

        <View style={{ gap: 6 }}>
          {RIGHT.map((k) => cell(k))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        {vm.totals.length ? vm.totals.map((t) => (
          <View key={t.text} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, borderWidth: 1, borderColor: GOLD_DIM, backgroundColor: '#1a1712' }}>
            <Text style={{ fontSize: 11, color: t.good ? '#9fd4a8' : '#e0857a', fontFamily: font.regular }}>{t.text}</Text>
          </View>
        )) : (
          <Text style={{ fontSize: 11, color: colors.textFaint, fontFamily: font.regular }}>Снаряжение не даёт бонусов</Text>
        )}
      </View>

      <View style={{ height: 1, backgroundColor: GOLD_DIM, marginVertical: 12 }} />
      <Text style={{ fontSize: 10.5, letterSpacing: 1.4, color: '#a8966c', marginBottom: 8, fontFamily: font.medium }}>
        ТАЙНИК ГИЛЬДИИ · {slot.label.toUpperCase()}
      </Text>
      {slot.stash.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {slot.stash.map((i) => (
            <StashCell key={i.id} item={i} active={picked?.id === i.id} onPress={() => setItemId(i.id)} />
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 12, color: colors.textFaint, fontFamily: font.regular }}>Пусто — добывайте предметы в подземельях или у торговца.</Text>
      )}

      {picked ? <Tooltip slot={slot} item={picked} /> : null}
    </View>
  );
}
