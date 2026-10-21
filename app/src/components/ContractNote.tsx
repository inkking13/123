import React from 'react';
import { Text, View } from 'react-native';
import { ContractVM } from '../engine/GameEngine';
import { font, ink } from '../theme/theme';
import { Icon } from './Icon';
import { Parchment, WaxSeal } from './Frame';

/** A contract written out on parchment: who pays, where, on what terms and for how much. */
export function ContractNote({ c, sealed, children, compact, stamp }: {
  c: ContractVM; sealed?: boolean; children?: React.ReactNode; compact?: boolean;
  /** A verdict stamped across the sheet once the contract closes. */
  stamp?: { text: string; ok: boolean };
}) {
  return (
    <Parchment style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12.5, letterSpacing: 0.8, color: ink.red, fontFamily: font.caps }}>{c.locationName}</Text>
          <Text style={{ fontSize: 20, lineHeight: 23, color: ink.text, fontFamily: font.title }}>{c.dungeonName}</Text>
        </View>
        {sealed ? <WaxSeal size={42}><Icon name={c.icon} size={18} color="#f3dcc0" weight="fill" /></WaxSeal> : null}
      </View>
      {!compact ? <Text style={{ fontSize: 14, lineHeight: 19, color: ink.muted, fontFamily: font.italic, marginTop: 6 }}>«{c.clientLine}» — {c.clientName}</Text> : null}
      <View style={{ height: 1, backgroundColor: ink.rule, marginVertical: 10 }} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <View style={{ marginTop: 2 }}><Icon name={c.icon} size={16} color={ink.text} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, color: ink.text, fontFamily: font.semibold }}>{c.termTitle}</Text>
          <Text style={{ fontSize: 14, lineHeight: 19, color: ink.muted, fontFamily: font.regular }}>{c.termDesc}</Text>
          {c.progress ? <Text style={{ fontSize: 13.5, color: ink.red, fontFamily: font.italic, marginTop: 3 }}>{c.progress}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 20, color: ink.text, fontFamily: font.title }}>{c.pay}</Text>
          <Text style={{ fontSize: 12, color: ink.muted, fontFamily: font.italic }}>золота</Text>
        </View>
      </View>
      {children}
      {stamp ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: 16, bottom: 18, transform: [{ rotate: '-10deg' }], borderWidth: 2.5, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 2, borderColor: stamp.ok ? ink.green : ink.red, opacity: 0.85 }}>
          <Text style={{ fontSize: 22, letterSpacing: 2, color: stamp.ok ? ink.green : ink.red, fontFamily: font.title }}>{stamp.text}</Text>
        </View>
      ) : null}
    </Parchment>
  );
}
