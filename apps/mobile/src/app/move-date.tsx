import { useMutation } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { DatePicker } from "@/components/date-picker";
import { api } from "@/lib/api";
import { useChecklist } from "@/lib/checklist";
import { formatMoveDate, parseLocalIsoDate, toLocalIsoDate } from "@/lib/dates";
import { toast } from "@/lib/toast";

export default function MoveDateScreen() {
  const { checklist, replace } = useChecklist();

  const [date, setDate] = useState<Date | null>(
    checklist?.targetMoveDate
      ? parseLocalIsoDate(checklist.targetMoveDate)
      : null,
  );

  const rebuild = useMutation({
    mutationFn: ({
      templateId,
      moveDate,
    }: {
      templateId: string;
      moveDate: Date;
    }) => api.createChecklist(templateId, toLocalIsoDate(moveDate)),

    onSuccess: (next, { moveDate }) => {
      // The response is the rebuilt checklist, so the dashboard and the checklist tab are
      // correct before this screen finishes closing — no refetch in between.
      replace(next);
      toast.success(
        "Move date updated",
        `Every deadline now counts from ${formatMoveDate(moveDate)}.`,
      );
      router.back();
    },

    meta: { errorMessage: "Couldn't update your move date." },
  });

  const completed = checklist?.completedCount ?? 0;
  const templateId = checklist?.templateId ?? null;

  function confirm() {
    if (!date || !templateId) return;

    // Regenerating wipes and recreates every row, so ticks are lost. That is worth an
    // explicit confirmation rather than a surprise — an Alert, because a toast can be
    // missed and this cannot be undone.
    if (completed > 0) {
      Alert.alert(
        "Rebuild your checklist?",
        `Changing your move date recalculates every deadline. The ${completed} ${
          completed === 1 ? "task you have ticked" : "tasks you have ticked"
        } will be marked unfinished again.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Rebuild", style: "destructive", onPress: save },
        ],
      );
      return;
    }
    save();
  }

  function save() {
    if (!date || !templateId) return;
    rebuild.mutate({ templateId, moveDate: date });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Move date" }} />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ padding: 24, gap: 24 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text className="text-body text-ink-muted">
          Every deadline on your checklist is worked out from this date. Change
          it and the whole schedule shifts with it.
        </Text>

        <Card>
          <DatePicker onChange={setDate} value={date} />
        </Card>

        {completed > 0 ? (
          <Card tone="sunken">
            <Text className="text-caption text-ink-muted">
              Rebuilding clears the {completed}{" "}
              {completed === 1 ? "task" : "tasks"} you have already ticked off.
            </Text>
          </Card>
        ) : null}

        <Button
          disabled={!date || !templateId}
          loading={rebuild.isPending}
          onPress={confirm}
          size="large"
          title="Update move date"
        />
      </ScrollView>
    </>
  );
}
