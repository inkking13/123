import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import { GameEngine } from './src/engine/GameEngine';
import { useEngineVersion } from './src/engine/useEngine';
import { colors } from './src/theme/theme';
import { TitleScreen } from './src/screens/TitleScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { RosterScreen } from './src/screens/RosterScreen';
import { CharacterScreen } from './src/screens/CharacterScreen';
import { GearScreen } from './src/screens/GearScreen';
import { DungeonScreen } from './src/screens/DungeonScreen';
import { CombatScreen } from './src/screens/CombatScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { QuestsScreen } from './src/screens/QuestsScreen';
import { InventoryScreen } from './src/screens/InventoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { EventScreen } from './src/screens/EventScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { PersonnelScreen } from './src/screens/PersonnelScreen';
import { LevelMapScreen } from './src/screens/LevelMapScreen';
import { HireScreen } from './src/screens/HireScreen';
import { ArenaScreen } from './src/screens/ArenaScreen';
import { ProfessionScreen } from './src/screens/ProfessionScreen';
import { AchievementsScreen } from './src/screens/AchievementsScreen';
import { WeeklyChallengeScreen } from './src/screens/WeeklyChallengeScreen';

function Root({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  switch (engine.screen) {
    case 'title': return <TitleScreen engine={engine} />;
    case 'home': return <HomeScreen engine={engine} />;
    case 'roster': return <RosterScreen engine={engine} />;
    case 'char': return <CharacterScreen engine={engine} />;
    case 'gear': return <GearScreen engine={engine} />;
    case 'dungeon': return <DungeonScreen engine={engine} />;
    case 'combat': return <CombatScreen engine={engine} />;
    case 'results': return <ResultsScreen engine={engine} />;
    case 'quests': return <QuestsScreen engine={engine} />;
    case 'inventory': return <InventoryScreen engine={engine} />;
    case 'settings': return <SettingsScreen engine={engine} />;
    case 'shop': return <ShopScreen engine={engine} />;
    case 'event': return <EventScreen engine={engine} />;
    case 'analytics': return <AnalyticsScreen engine={engine} />;
    case 'personnel': return <PersonnelScreen engine={engine} />;
    case 'levelmap': return <LevelMapScreen engine={engine} />;
    case 'hire': return <HireScreen engine={engine} />;
    case 'arena': return <ArenaScreen engine={engine} />;
    case 'profession': return <ProfessionScreen engine={engine} />;
    case 'achievements': return <AchievementsScreen engine={engine} />;
    case 'weekly': return <WeeklyChallengeScreen engine={engine} />;
    default: return null;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  const engine = useMemo(() => new GameEngine(), []);

  const [saveLoaded, setSaveLoaded] = useState(false);
  useEffect(() => {
    engine.load().then(() => setSaveLoaded(true));
  }, [engine]);

  if (!fontsLoaded || !saveLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Root engine={engine} />
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}
