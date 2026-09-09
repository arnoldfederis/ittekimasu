import { Image } from "expo-image";
import { Stack } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Card } from "@/components/card";
import { useOfflineBannerClearance } from "@/components/offline-banner";
import { useThemeColors } from "@/constants/theme";
import {
  TEXT_SCALE_FACTOR,
  TEXT_SCALE_LABEL,
  TEXT_SCALES,
  useDisplayPrefs,
} from "@/lib/display-prefs";
import { formatBackText } from "@/lib/romaji";

/**
 * The two things being previewed. Real content, not lorem: おとこ is the example the reading
 * toggle is easiest to understand through, because otoko and おとこ are unmistakably the same
 * word written two ways.
 */
const KANA_SAMPLE = { glyph: "あ", romaji: "a" };
const CARD_SAMPLE = { front: "男", back: "おとこ · man" };

/** The kana sheet's own base size, scaled down so both previews fit on one screen without
 * scrolling at the default setting. The RATIO between the two previews is what matters here;
 * the sheet itself uses the full size. */
const KANA_PREVIEW_BASE = 76;

/**
 * Display settings, pushed from Settings.
 *
 * A page rather than a sheet because it has previews: the point is to see what a change does
 * before committing to it, and a sheet that covers the thing it is changing cannot do that.
 * Both preferences are device-only — they alter nothing about scheduling, so there is no save
 * button, no request, and no spinner.
 */
export default function DisplaySettingsScreen() {
  const colors = useThemeColors();
  const bannerClearance = useOfflineBannerClearance();
  const prefs = useDisplayPrefs();
  const scale = TEXT_SCALE_FACTOR[prefs.textScale];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Display" }} />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 40 + bannerClearance }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-4 px-4 pt-4">
          <Text className="px-1 font-semibold text-caption text-ink-subtle">
            PREVIEW
          </Text>

          <View className="flex-row gap-3">
            <Card className="flex-1">
              <View className="items-center gap-2">
                <Text
                  className="text-ink"
                  style={{
                    fontSize: KANA_PREVIEW_BASE * scale,
                    lineHeight: KANA_PREVIEW_BASE * scale * 1.24,
                  }}
                >
                  {KANA_SAMPLE.glyph}
                </Text>
                {/* An empty box, not a placeholder character: a dot where the reading was
                    reads as though the answer were "·". This only holds the height so the
                    two previews stay level when the toggle flips. */}
                <View
                  style={{ height: 15 * scale * 1.4, justifyContent: "center" }}
                >
                  {prefs.showRomaji ? (
                    <Text
                      className="font-semibold text-callout text-primary"
                      style={{ fontSize: 15 * scale }}
                    >
                      {KANA_SAMPLE.romaji}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-caption text-ink-subtle">Kana chart</Text>
              </View>
            </Card>

            <Card className="flex-1">
              <View className="items-center gap-2">
                <Text
                  className="font-semibold text-ink"
                  style={{
                    fontSize: 34 * scale,
                    lineHeight: 34 * scale * 1.2,
                  }}
                >
                  {CARD_SAMPLE.front}
                </Text>
                <Text
                  className="text-center text-ink"
                  style={{ fontSize: 22 * scale, lineHeight: 22 * scale * 1.3 }}
                >
                  {formatBackText(CARD_SAMPLE.back, prefs.showRomaji)}
                </Text>
                <Text className="text-caption text-ink-subtle">Cards</Text>
              </View>
            </Card>
          </View>

          <Text className="px-1 pt-2 font-semibold text-caption text-ink-subtle">
            TEXT SIZE
          </Text>

          <View className="flex-row gap-2">
            {TEXT_SCALES.map((option) => {
              const selected = prefs.textScale === option;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`min-h-12 flex-1 items-center justify-center rounded-button border ${
                    selected
                      ? "border-primary bg-primary-tint"
                      : "border-line bg-surface"
                  }`}
                  key={option}
                  onPress={() => prefs.setTextScale(option)}
                >
                  <Text
                    className={
                      selected
                        ? "font-semibold text-callout text-primary"
                        : "text-callout text-ink-muted"
                    }
                  >
                    {TEXT_SCALE_LABEL[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="px-1 text-caption text-ink-muted">
            Applies to review cards and the kana chart.
          </Text>

          <Text className="px-1 pt-2 font-semibold text-caption text-ink-subtle">
            READINGS
          </Text>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: prefs.showRomaji }}
            className="min-h-14 flex-row items-center gap-3 rounded-card border border-line bg-surface px-4"
            onPress={() => prefs.setShowRomaji(!prefs.showRomaji)}
            style={{ borderCurve: "continuous" }}
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-body text-ink">Show romaji</Text>
              <Text className="text-caption text-ink-muted">
                {prefs.showRomaji
                  ? "Readings appear as otoko"
                  : "Readings appear as おとこ"}
              </Text>
            </View>
            <Image
              source={
                prefs.showRomaji ? "sf:checkmark.circle.fill" : "sf:circle"
              }
              style={{ width: 22, height: 22 }}
              tintColor={prefs.showRomaji ? colors.primary : colors.inkSubtle}
            />
          </Pressable>

          <Text className="px-1 text-caption text-ink-muted">
            Off is the harder setting, and the one worth moving to: reading the
            kana is the skill. Audio always plays the Japanese either way.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
