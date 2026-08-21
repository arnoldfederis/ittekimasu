import { ScrollView, View } from "react-native";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ScreenHeader } from "@/components/screen-header";

export default function LearnScreen() {
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ScreenHeader
        subtitle="Spaced repetition, a few minutes a day"
        title="Learn"
      />

      <View className="gap-4 px-4">
        <Card tone="accent">
          <CardTitle>Streak</CardTitle>
          <CardCaption>Starts once reviews are live in step 5</CardCaption>
        </Card>

        <Card>
          <CardTitle>JLPT N5</CardTitle>
          <CardCaption>Deck seeded in step 4, reviews in step 5</CardCaption>
        </Card>

        <Card className="opacity-65" tone="sunken">
          <CardTitle>JLPT N4 · Premium</CardTitle>
          <CardCaption>
            Visible on purpose — the paywall should feel like an unlock
          </CardCaption>
        </Card>
      </View>
    </ScrollView>
  );
}
