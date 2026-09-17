import { Image } from "expo-image";
import { Modal, Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/constants/theme";
import {
  TEXT_SCALE_FACTOR,
  TEXT_SCALE_LABEL,
  TEXT_SCALES,
  type TextScale,
  useCardDisplayPrefs,
  useKanaDisplayPrefs,
} from "@/lib/display-prefs";
import { formatBackText } from "@/lib/romaji";

/**
 * Real content, not lorem. おとこ is the example the reading switch is easiest to understand
 * through, because otoko and おとこ are unmistakably the same word written two ways.
 */
const CARD_SAMPLE = { front: "男", back: "おとこ · man" };
const KANA_SAMPLE = { glyph: "あ", romaji: "a" };

/** The sheet's preview is smaller than the real thing; the RATIO is what it is showing. */
const KANA_PREVIEW_BASE = 64;
const CARD_FRONT_BASE = 34;
const CARD_BACK_BASE = 17;

/**
 * Text size — and for cards, romaji — on top of whatever they are changing.
 *
 * These used to live only in Settings, on the argument that a change should be previewed
 * against a card first. In practice the card is right there and the setting was four taps
 * and two screens away, so wanting bigger type mid-session meant abandoning the session. The
 * preview was worth less than the round trip, and a sheet sitting OVER the card previews it
 * better than a settings page can — the thing behind it is the real thing. The small preview
 * inside is for the half of the sheet that covers what you are looking at.
 *
 * Scoped, because a single glyph you are studying the shape of and a word with a reading and
 * a gloss under it are not read at the same size. `kana` has no romaji switch: the chart
 * always shows readings while browsing, and practice always hides them, so a preference
 * could only break one of those.
 */
export function DisplayPrefsSheet({
  scope,
  visible,
  onClose,
}: {
  scope: "kana" | "cards";
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View className="flex-1 bg-canvas">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-callout text-ink-muted">
            {scope === "kana" ? "Kana display" : "Card display"}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="min-h-11 justify-center px-2 active:opacity-60"
            onPress={onClose}
          >
            <Text className="font-semibold text-body text-primary">Done</Text>
          </Pressable>
        </View>

        {scope === "kana" ? <KanaControls /> : <CardControls />}
      </View>
    </Modal>
  );
}

function KanaControls() {
  const prefs = useKanaDisplayPrefs();
  const scale = TEXT_SCALE_FACTOR[prefs.textScale];

  return (
    <View className="gap-6 px-4 pt-4">
      <Preview>
        <Text
          className="text-ink"
          style={{
            fontSize: KANA_PREVIEW_BASE * scale,
            lineHeight: KANA_PREVIEW_BASE * scale * 1.24,
          }}
        >
          {KANA_SAMPLE.glyph}
        </Text>
        <Text className="font-semibold text-heading text-primary">
          {KANA_SAMPLE.romaji}
        </Text>
      </Preview>

      <ScaleControl onChange={prefs.setTextScale} value={prefs.textScale} />

      <Text className="px-1 text-caption text-ink-subtle">
        Applies to the kana chart and its cards. Vocabulary cards have their own
        size.
      </Text>
    </View>
  );
}

function CardControls() {
  const colors = useThemeColors();
  const prefs = useCardDisplayPrefs();
  const scale = TEXT_SCALE_FACTOR[prefs.textScale];

  return (
    <View className="gap-6 px-4 pt-4">
      <Preview>
        <Text
          className="text-ink"
          style={{
            fontSize: CARD_FRONT_BASE * scale,
            lineHeight: CARD_FRONT_BASE * scale * 1.3,
          }}
        >
          {CARD_SAMPLE.front}
        </Text>
        <Text
          className="text-ink-muted"
          style={{
            fontSize: CARD_BACK_BASE * scale,
            lineHeight: CARD_BACK_BASE * scale * 1.4,
          }}
        >
          {formatBackText(CARD_SAMPLE.back, prefs.showRomaji)}
        </Text>
      </Preview>

      <ScaleControl onChange={prefs.setTextScale} value={prefs.textScale} />

      <View className="gap-2">
        <Text className="px-1 font-semibold text-caption text-ink-subtle">
          READINGS
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: prefs.showRomaji }}
          className="min-h-14 flex-row items-center gap-3 rounded-card bg-surface px-4 py-3 active:opacity-70"
          onPress={() => prefs.setShowRomaji(!prefs.showRomaji)}
          style={{ borderCurve: "continuous" }}
        >
          <View className="flex-1 gap-0.5">
            <Text className="text-body text-ink">Show romaji</Text>
            <Text className="text-caption text-ink-muted">
              Readings appear as otoko
            </Text>
          </View>
          <Image
            source={prefs.showRomaji ? "sf:checkmark.circle.fill" : "sf:circle"}
            style={{ width: 22, height: 22 }}
            tintColor={prefs.showRomaji ? colors.primary : colors.inkSubtle}
          />
        </Pressable>
        <Text className="px-1 text-caption text-ink-subtle">
          Off is the harder setting, and the one worth moving to: reading the
          kana is the skill. Audio always plays the Japanese either way.
        </Text>
      </View>
    </View>
  );
}

/** Fixed height so stepping through the sizes does not shunt the controls down the screen. */
function Preview({ children }: { children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="px-1 font-semibold text-caption text-ink-subtle">
        PREVIEW
      </Text>
      <View
        className="h-40 items-center justify-center gap-1 rounded-card bg-surface px-4"
        style={{ borderCurve: "continuous" }}
      >
        {children}
      </View>
    </View>
  );
}

function ScaleControl({
  value,
  onChange,
}: {
  value: TextScale;
  onChange: (scale: TextScale) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="px-1 font-semibold text-caption text-ink-subtle">
        TEXT SIZE
      </Text>
      <View className="flex-row gap-2">
        {TEXT_SCALES.map((scale) => {
          const selected = value === scale;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`flex-1 items-center rounded-button border py-3 ${
                selected
                  ? "border-primary bg-primary-tint"
                  : "border-line bg-surface"
              }`}
              key={scale}
              onPress={() => onChange(scale)}
              style={{ borderCurve: "continuous" }}
            >
              <Text
                className={`text-callout ${
                  selected ? "font-semibold text-primary" : "text-ink-muted"
                }`}
              >
                {TEXT_SCALE_LABEL[scale]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
