import { Alert, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { ScreenHeader } from "@/components/screen-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently removes your checklist, review history, and account. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    try {
      await api.deleteMe();
      await signOut();
    } catch (error) {
      toast.fromError(error, "Could not reach the server. Try again.");
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ScreenHeader subtitle={user?.email ?? undefined} title="Profile" />

      <View className="gap-4 px-4">
        <Card>
          <CardTitle>{user?.displayName ?? "Signed in"}</CardTitle>
          <CardCaption>
            Plan status arrives with RevenueCat in step 6
          </CardCaption>
        </Card>

        <View className="overflow-hidden rounded-card bg-surface">
          <Text className="px-4 pt-4 pb-1 font-semibold text-caption text-ink-subtle">
            ACCOUNT
          </Text>
          <ListRow
            icon="doc.text"
            showChevron
            title="Visa type"
            value="Not set"
          />
          <ListRow
            icon="calendar"
            showChevron
            title="Move date"
            value="Not set"
          />
        </View>

        <Button onPress={signOut} title="Sign out" variant="secondary" />

        {/* App Store review guideline 5.1.1(v) requires in-app account deletion. */}
        <Button
          onPress={confirmDelete}
          title="Delete account"
          variant="destructive"
        />
      </View>
    </ScrollView>
  );
}
