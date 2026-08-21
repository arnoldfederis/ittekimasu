import { ScrollView, Text, View } from "react-native";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { ScreenHeader } from "@/components/screen-header";

export default function ChecklistScreen() {
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ScreenHeader
        subtitle="Grouped by category, due against your move date"
        title="Checklist"
      />

      <View className="gap-4 px-4">
        <Card tone="sunken">
          <CardTitle>Guidance only</CardTitle>
          <CardCaption>
            Task content is not verified immigration advice. Confirm anything
            legally binding with the Immigration Services Agency and your
            employer&apos;s HR.
          </CardCaption>
        </Card>

        <View className="overflow-hidden rounded-card bg-surface">
          <Text className="px-4 pt-4 pb-1 font-semibold text-caption text-ink-subtle">
            VISA &amp; IMMIGRATION
          </Text>
          <ListRow
            icon="circle"
            subtitle="Wired to GET /users/me/checklist in step 3"
            title="Tasks appear here after onboarding"
          />
        </View>
      </View>
    </ScrollView>
  );
}
