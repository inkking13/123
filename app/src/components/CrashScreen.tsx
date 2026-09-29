import React, { Component } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

// When the game hits an error it can't recover from, show what went wrong
// instead of the app silently closing, so a player can send a screenshot.

type Fatal = { message: string; stack?: string };
const listeners = new Set<(f: Fatal) => void>();
let last: Fatal | null = null;

/** Show the error screen for an error caught outside React (e.g. while loading modules). */
export function reportFatal(e: any) {
  last = { message: String(e?.message ?? e), stack: String(e?.stack ?? '') };
  listeners.forEach((l) => l(last!));
}

/** Route uncaught errors (event handlers, timers, promises) here as well as render errors. */
export function installCrashHandler() {
  const EU = (globalThis as any).ErrorUtils;
  if (!EU?.setGlobalHandler) return;
  const prev = EU.getGlobalHandler?.();
  EU.setGlobalHandler((e: any, isFatal?: boolean) => {
    if (isFatal) { reportFatal(e); return; }
    prev?.(e, isFatal);
  });
}

export class CrashGuard extends Component<{ children: React.ReactNode; onReset?: () => void }, { fatal: Fatal | null }> {
  state = { fatal: last };
  private onFatal = (f: Fatal) => this.setState({ fatal: f });
  componentDidMount() { listeners.add(this.onFatal); if (last && !this.state.fatal) this.setState({ fatal: last }); }
  componentWillUnmount() { listeners.delete(this.onFatal); }
  static getDerivedStateFromError(e: any) { return { fatal: { message: String(e?.message ?? e), stack: String(e?.stack ?? '') } }; }
  render() {
    const f = this.state.fatal;
    if (!f) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#161826', paddingTop: 48, paddingHorizontal: 18 }}>
        <Text style={{ color: '#e2bf85', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Игра споткнулась</Text>
        <Text style={{ color: '#c9c6d4', fontSize: 13, marginBottom: 12 }}>Сделайте скриншот этого экрана и отправьте разработчику.</Text>
        <ScrollView style={{ flex: 1, borderWidth: 1, borderColor: '#3a3550', borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <Text selectable style={{ color: '#ff9d8f', fontSize: 13, marginBottom: 8 }}>{f.message}</Text>
          <Text selectable style={{ color: '#9a96ab', fontSize: 10.5 }}>{(f.stack ?? '').split('\n').slice(0, 14).join('\n')}</Text>
        </ScrollView>
        <Pressable onPress={() => { last = null; this.props.onReset?.(); this.setState({ fatal: null }); }} style={{ height: 46, borderRadius: 8, borderWidth: 1, borderColor: '#e2bf85', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <Text style={{ color: '#e2bf85', fontSize: 15, fontWeight: '600' }}>Попробовать снова</Text>
        </Pressable>
      </View>
    );
  }
}
