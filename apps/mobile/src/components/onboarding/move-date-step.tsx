import { ScrollView, Text, View } from "react-native";
import { Card } from "@/components/card";
import { DatePicker } from "@/components/date-picker";
import { formatMoveDate } from "@/lib/dates";
import { useOnboarding } from "@/lib/onboarding";

/**
 * Step 3. A real day picker: plenty of people know their flight date, and pinning everyone
 * to the 1st of the month quietly shifted every deadline by up to four weeks.
 */
export function MoveDateStep() {
  const { targetMoveDate, setTargetMoveDate, template } = useOnboarding();

  return (
    <ScrollView
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-2">
        <Text className="font-semibold text-ink text-title">
          When are you moving?
        </Text>
        <Text className="text-body text-ink-muted">
          Every deadline is worked out from this date — the COE about three
          months before, ward-office registration two weeks after you land. An
          approximate date is fine; you can change it later.
        </Text>
      </View>

      <Card>
        <DatePicker onChange={setTargetMoveDate} value={targetMoveDate} />
      </Card>

      {targetMoveDate && template ? (
        <Card tone="sunken">
          <Text className="text-caption text-ink-muted">
            {template.displayName}, moving{" "}
            <Text className="font-semibold text-ink">
              {formatMoveDate(targetMoveDate)}
            </Text>
            .
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}
