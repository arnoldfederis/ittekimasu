import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { useOnboarding } from "@/lib/onboarding";
import { templatesQuery } from "@/lib/queries";

/** Badged as the common case so a first-time user has an obvious default. */
const MOST_COMMON_VISA_TYPE = "ENGINEER_SPECIALIST";

/** Step 2. A pane inside the onboarding pager — the footer buttons live on the pager. */
export function VisaStep() {
  const { purpose, template, setTemplate } = useOnboarding();

  // Keyed by purpose, so going back and editing that answer swaps the list — and coming
  // forward again reads the earlier answer straight from the cache.
  const {
    data: templates = null,
    isError: failed,
    refetch,
  } = useQuery(templatesQuery(purpose ?? undefined));

  const load = () => {
    refetch();
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-2">
        <Text className="font-semibold text-ink text-title">
          Which visa are you on?
        </Text>
        <Text className="text-body text-ink-muted">
          Pick the closest match. You can change it later in your profile.
        </Text>
      </View>

      {templates === null && !failed ? (
        <ActivityIndicator className="py-8" />
      ) : null}

      {failed ? (
        <Card tone="sunken">
          <Text className="text-body text-ink">
            Couldn&apos;t reach the server.
          </Text>
          <View className="pt-3">
            <Button onPress={load} title="Try again" variant="secondary" />
          </View>
        </Card>
      ) : null}

      <View className="gap-3">
        {templates?.map((option) => (
          <Card
            disabled={!option.available}
            key={option.id}
            onPress={() => setTemplate(option)}
            selected={template?.id === option.id}
          >
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-semibold text-body text-ink">
                  {option.displayName}
                </Text>
                {option.visaType === MOST_COMMON_VISA_TYPE ? (
                  <View className="rounded-pill bg-primary-tint px-2 py-0.5">
                    <Text className="font-semibold text-caption text-primary">
                      Most common
                    </Text>
                  </View>
                ) : null}
                {!option.available ? (
                  <View className="rounded-pill bg-surface-sunken px-2 py-0.5">
                    <Text className="font-semibold text-caption text-ink-subtle">
                      Coming soon
                    </Text>
                  </View>
                ) : null}
              </View>

              {option.japaneseName ? (
                <Text className="text-callout text-ink-muted">
                  {option.japaneseName}
                </Text>
              ) : null}
              {option.description ? (
                <Text className="text-caption text-ink-subtle">
                  {option.description}
                </Text>
              ) : null}
            </View>
          </Card>
        ))}
      </View>

      {/* Dashed, so it reads as a way out rather than another option in the list. */}
      {templates?.length ? (
        <View
          className="rounded-card border-2 border-line border-dashed p-4"
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-body text-ink">Not sure which one?</Text>
          <Text className="pt-1 text-caption text-ink-muted">
            A short quiz to narrow it down is coming soon. For now, pick the
            closest match — nothing here is locked in.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
