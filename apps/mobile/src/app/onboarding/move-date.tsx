import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { StepProgress } from "@/components/step-progress";
import { useThemeColors } from "@/constants/theme";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useOnboarding } from "@/lib/onboarding";
import { toast } from "@/lib/toast";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * A month/year picker rather than a full date picker: nobody knows the exact day they will
 * land a year out, and every due date is generated from this one value anyway. The day is
 * pinned to the 1st.
 */
export default function MoveDateScreen() {
  const colors = useThemeColors();
  const { targetMoveDate, setTargetMoveDate, template } = useOnboarding();
  const { markOnboarded } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(
    targetMoveDate?.getFullYear() ?? now.getFullYear(),
  );
  const [month, setMonth] = useState<number | null>(
    targetMoveDate ? targetMoveDate.getMonth() : null,
  );
  const [saving, setSaving] = useState(false);

  const selected = month === null ? null : new Date(year, month, 1);
  // Only the current year is partially in the past; earlier months make no sense to pick.
  const isPast = (index: number) =>
    year < now.getFullYear() ||
    (year === now.getFullYear() && index < now.getMonth());

  async function finish() {
    if (!selected || !template) return;
    setSaving(true);
    try {
      setTargetMoveDate(selected);

      // Local date, not toISOString(): that converts to UTC and can shift the month back a
      // day for anyone east of Greenwich — including everyone in Japan.
      const isoDate = `${selected.getFullYear()}-${String(
        selected.getMonth() + 1,
      ).padStart(2, "0")}-01`;

      const checklist = await api.createChecklist(template.id, isoDate);

      // Only flip the guard once the server actually has the checklist, otherwise the user
      // lands on an empty dashboard with no way back into onboarding.
      await markOnboarded();
      toast.success(
        "Your checklist is ready",
        `${checklist.totalCount} tasks, starting ${checklist.totalCount > 0 ? "now" : "soon"}.`,
      );
    } catch (error) {
      toast.fromError(error, "Couldn't build your checklist. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <StepProgress step={3} total={3} />

      <View className="gap-2">
        <Text className="font-semibold text-ink text-title">
          When are you moving?
        </Text>
        <Text className="text-body text-ink-muted">
          Every deadline is worked out from this date — the COE about three
          months before, ward-office registration two weeks after you land. A
          rough month is enough.
        </Text>
      </View>

      <Card>
        <View className="flex-row items-center justify-between pb-4">
          <Pressable
            accessibilityLabel="Previous year"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center rounded-pill active:bg-surface-sunken"
            disabled={year <= now.getFullYear()}
            onPress={() => setYear((current) => current - 1)}
          >
            <Image
              source="sf:chevron.left"
              style={{
                width: 16,
                height: 16,
                opacity: year <= now.getFullYear() ? 0.3 : 1,
              }}
              tintColor={colors.ink}
            />
          </Pressable>

          <Text
            className="font-semibold text-heading text-ink"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {year}
          </Text>

          <Pressable
            accessibilityLabel="Next year"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center rounded-pill active:bg-surface-sunken"
            onPress={() => setYear((current) => current + 1)}
          >
            <Image
              source="sf:chevron.right"
              style={{ width: 16, height: 16 }}
              tintColor={colors.ink}
            />
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {MONTHS.map((label, index) => {
            const disabled = isPast(index);
            const isSelected = month === index;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled, selected: isSelected }}
                className={`h-12 items-center justify-center rounded-button ${
                  isSelected ? "bg-primary" : "bg-surface-sunken"
                } ${disabled ? "opacity-30" : "active:opacity-70"}`}
                disabled={disabled}
                key={label}
                onPress={() => setMonth(index)}
                style={{ width: "30%", borderCurve: "continuous" }}
              >
                <Text
                  className={`text-body ${
                    isSelected ? "font-semibold text-ink-inverse" : "text-ink"
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {selected && template ? (
        <Card tone="sunken">
          <Text className="text-caption text-ink-muted">
            {template.displayName}, moving{" "}
            <Text className="font-semibold text-ink">
              {MONTHS[selected.getMonth()]} {selected.getFullYear()}
            </Text>
            .
          </Text>
        </Card>
      ) : null}

      <Button
        disabled={!selected}
        loading={saving}
        onPress={finish}
        size="large"
        title="Build my checklist"
      />
    </ScrollView>
  );
}
