import React from 'react';
import {
  ArrowRight, ArrowLeft, CaretRight, SkullIcon, LockSimple, Scroll, Check,
  ShieldChevron, DoorOpen, CrownSimple, Sword, HandPalm, Megaphone,
  Pause, Play, Shield, FirstAidKit, Campfire, UsersThree, PathIcon, SnowflakeIcon,
  FlaskIcon, DropIcon, FlameIcon, TargetIcon, FireIcon,
  GearSix, SpeakerHigh, SpeakerSlash, Vibrate, TrashSimple, Warning, CoinsIcon, Storefront, ChartLineUpIcon,
  TrophyIcon, IdentificationCardIcon, HardHat, HandFist, Boot, Diamond,
} from 'phosphor-react-native';

export type IconName =
  | 'arrow-right' | 'arrow-left' | 'caret-right' | 'skull' | 'lock-simple' | 'scroll' | 'check'
  | 'shield-chevron' | 'door-open' | 'crown-simple' | 'sword' | 'hand-palm' | 'megaphone'
  | 'pause' | 'play' | 'shield' | 'first-aid-kit' | 'campfire' | 'users-three' | 'path' | 'snowflake'
  | 'flask' | 'drop' | 'flame' | 'target' | 'fire'
  | 'gear' | 'speaker-high' | 'speaker-slash' | 'vibrate' | 'trash-simple' | 'warning'
  | 'coins' | 'storefront' | 'chart-line-up' | 'trophy' | 'identification-card'
  | 'hard-hat' | 'hand-fist' | 'boot' | 'diamond';

const MAP: Record<IconName, React.ComponentType<any>> = {
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'caret-right': CaretRight,
  skull: SkullIcon,
  'lock-simple': LockSimple,
  scroll: Scroll,
  check: Check,
  'shield-chevron': ShieldChevron,
  'door-open': DoorOpen,
  'crown-simple': CrownSimple,
  sword: Sword,
  'hand-palm': HandPalm,
  megaphone: Megaphone,
  pause: Pause,
  play: Play,
  shield: Shield,
  'first-aid-kit': FirstAidKit,
  campfire: Campfire,
  'users-three': UsersThree,
  path: PathIcon,
  snowflake: SnowflakeIcon,
  flask: FlaskIcon,
  drop: DropIcon,
  flame: FlameIcon,
  target: TargetIcon,
  fire: FireIcon,
  gear: GearSix,
  'speaker-high': SpeakerHigh,
  'speaker-slash': SpeakerSlash,
  vibrate: Vibrate,
  'trash-simple': TrashSimple,
  warning: Warning,
  coins: CoinsIcon,
  storefront: Storefront,
  'chart-line-up': ChartLineUpIcon,
  trophy: TrophyIcon,
  'identification-card': IdentificationCardIcon,
  'hard-hat': HardHat,
  'hand-fist': HandFist,
  boot: Boot,
  diamond: Diamond,
};

export function Icon({
  name, size = 18, color = '#e9e9ed', weight = 'regular',
}: { name: IconName; size?: number; color?: string; weight?: 'regular' | 'fill' }) {
  const C = MAP[name];
  return <C size={size} color={color} weight={weight} />;
}
