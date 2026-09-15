import { Image } from "expo-image";
import { Stack } from "expo-router";
import type * as Speech from "expo-speech";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { useOfflineBannerClearance } from "@/components/offline-banner";
import { useThemeColors } from "@/constants/theme";
import { openAppSettings } from "@/lib/open-url";
import {
  applyAudioMode,
  getSelectedVoice,
  japaneseVoices,
  playsInSilentMode,
  setPlaysInSilentMode,
  setSelectedVoice,
  speakReading,
} from "@/lib/speech";

/** Spoken when a voice is picked, so the choice is audible rather than a name on a list. */
const SAMPLE = "はじめまして";

export default function VoiceScreen() {
  const colors = useThemeColors();
  const [voices, setVoices] = useState<Speech.Voice[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [silentMode, setSilentMode] = useState(false);
  // Without this the last voice in the list sits under the offline banner.
  const bannerClearance = useOfflineBannerClearance();

  useEffect(() => {
    japaneseVoices().then(setVoices);
    getSelectedVoice().then(setSelected);
    playsInSilentMode().then(setSilentMode);
    /*
     * Push the stored preference into the audio session on the way in.
     *
     * AVAudioSession is process-wide and only ever written by setPlaysInSilentMode, so on a
     * fresh launch this screen inherited whatever category iOS defaulted to. With the
     * preference already ON, previews were still silenced by the ring switch until the
     * toggle was flipped off and on again — on the one screen whose whole job is auditioning
     * voices.
     */
    applyAudioMode();
  }, []);

  async function toggleSilentMode(enabled: boolean) {
    setSilentMode(enabled);
    await setPlaysInSilentMode(enabled);
  }

  async function choose(identifier: string | null) {
    setSelected(identifier);
    await setSelectedVoice(identifier);
    // Play it immediately — a voice name means nothing until you have heard it.
    speakReading(SAMPLE, identifier);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Voice" }} />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{
          padding: 24,
          gap: 16,
          paddingBottom: 24 + bannerClearance,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text className="text-body text-ink-muted">
          Used when a card&apos;s reading is spoken. Tap one to hear it.
        </Text>

        {/*
          Says the quiet part out loud, on the one screen where hearing nothing looks like a
          broken app rather than a working mute switch. Only while the preference is off —
          once it is on there is nothing left to explain.
        */}
        {silentMode ? null : (
          <Text className="text-caption text-ink-muted">
            Hearing nothing? Your phone&apos;s ring/silent switch mutes
            previews. Turn on &quot;Play even when silent&quot; below.
          </Text>
        )}

        {/*
          The single most common reason audio "doesn't work" — paired with the switch that
          fixes it. Off by default: speaking out loud on a phone the user deliberately
          silenced is worse than staying quiet.
        */}
        <View className="overflow-hidden rounded-card bg-surface">
          <View className="min-h-14 flex-row items-center gap-3 px-4 py-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-body text-ink">Play even when silent</Text>
              <Text className="text-caption text-ink-muted">
                iOS normally mutes readings when your ring/silent switch is off.
              </Text>
            </View>
            <Switch
              onValueChange={toggleSilentMode}
              thumbColor={colors.surface}
              trackColor={{ false: colors.line, true: colors.primary }}
              value={silentMode}
            />
          </View>
        </View>

        <View className="overflow-hidden rounded-card bg-surface">
          <VoiceRow
            checked={selected === null}
            onPress={() => choose(null)}
            subtitle="Whichever Japanese voice your phone prefers"
            tint={colors.primary}
            title="System default"
          />

          {voices?.map((voice) => (
            <VoiceRow
              checked={selected === voice.identifier}
              key={voice.identifier}
              onPress={() => choose(voice.identifier)}
              subtitle={
                voice.quality === "Enhanced" ? "Enhanced quality" : undefined
              }
              tint={colors.primary}
              title={voice.name}
            />
          ))}
        </View>

        {/*
          Apps cannot install system voices, so when the phone has only Kyoko this screen has
          nothing to offer. Saying where to get more is more useful than a list of one.
        */}
        {voices !== null && voices.length <= 1 ? (
          <Card tone="sunken">
            <Text className="text-body text-ink">Want a different voice?</Text>
            <Text className="pt-1 text-caption text-ink-muted">
              iOS ships one Japanese voice. You can add others — including
              higher-quality ones — in Settings → Accessibility → Spoken Content
              → Voices → Japanese.
            </Text>
            <View className="pt-3">
              <Button
                onPress={() => openAppSettings()}
                title="Open Settings"
                variant="secondary"
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}

function VoiceRow({
  title,
  subtitle,
  checked,
  tint,
  onPress,
}: {
  title: string;
  subtitle?: string;
  checked: boolean;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-sunken"
      onPress={onPress}
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-body text-ink">{title}</Text>
        {subtitle ? (
          <Text className="text-caption text-ink-muted">{subtitle}</Text>
        ) : null}
      </View>
      {checked ? (
        <Image
          source="sf:checkmark"
          style={{ width: 16, height: 16 }}
          tintColor={tint}
        />
      ) : null}
    </Pressable>
  );
}
