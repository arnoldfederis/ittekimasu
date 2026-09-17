import { Stack } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useOfflineBannerClearance } from "@/components/offline-banner";
import { KANA_STROKES_LICENSE } from "@/constants/kana-strokes-license";
import {
  STROKE_FONT_HOME,
  STROKE_FONT_LICENSE,
} from "@/constants/stroke-font-license";

const STROKESVG_URL = "https://github.com/zhengkyl/strokesvg";

/**
 * Third-party notices, pushed from Settings ▸ About.
 *
 * Not decoration and not marketing. The kana stroke diagrams are a Modified Version of Klee
 * One under the SIL Open Font License, and the kanji stroke order is a BSD-3 licensed font —
 * both ask for the copyright
 * notice and the licence terms to travel with the software in a readable form. The app is
 * the only thing being distributed, so "readable" has to mean a screen.
 *
 * In-app rather than a link to the marketing site, unlike the privacy policy and the terms.
 * Those exist because App Review needs a public URL; this one exists because someone holding
 * the app is entitled to read it — including on a plane, which is exactly where the kana
 * chart gets used.
 *
 * The text is generated from the pinned upstream commit by scripts/generate-kana-strokes.mjs,
 * so it cannot drift from the outlines it covers.
 */
export default function AcknowledgementsScreen() {
  const bannerClearance = useOfflineBannerClearance();

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: "Acknowledgements" }}
      />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 40 + bannerClearance }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-4 px-4 pt-4">
          <View
            className="gap-2 rounded-card bg-surface p-4"
            style={{ borderCurve: "continuous" }}
          >
            <Text className="font-semibold text-body text-ink">
              Kana stroke order
            </Text>
            <Text className="text-callout text-ink-muted">
              The stroke diagrams in the kana chart are traced from the Klee One
              typeface by way of strokesvg, and are used and redistributed under
              the SIL Open Font License 1.1.
            </Text>
            <Text className="text-caption text-ink-subtle">
              {STROKESVG_URL}
            </Text>
          </View>

          <View
            className="gap-2 rounded-card bg-surface p-4"
            style={{ borderCurve: "continuous" }}
          >
            <Text className="font-semibold text-body text-ink">
              Kanji stroke order
            </Text>
            <Text className="text-callout text-ink-muted">
              The stroke order shown on vocabulary cards is drawn with the Kanji
              Stroke Order font, used and redistributed under a BSD 3-clause
              licence.
            </Text>
            <Text className="text-caption text-ink-subtle">
              {STROKE_FONT_HOME}
            </Text>
          </View>

          {/*
            Verbatim, and monospaced: a licence that has been reflowed or prettified is a
            licence someone has edited. Selectable so it can be copied out.
          */}
          <View
            className="rounded-card bg-surface p-4"
            style={{ borderCurve: "continuous" }}
          >
            <Text
              className="text-ink-muted"
              selectable
              style={{ fontFamily: "Menlo", fontSize: 11, lineHeight: 17 }}
            >
              {KANA_STROKES_LICENSE}
            </Text>
          </View>

          <View
            className="rounded-card bg-surface p-4"
            style={{ borderCurve: "continuous" }}
          >
            <Text
              className="text-ink-muted"
              selectable
              style={{ fontFamily: "Menlo", fontSize: 11, lineHeight: 17 }}
            >
              {STROKE_FONT_LICENSE}
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
