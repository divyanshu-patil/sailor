import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import React, { useEffect } from "react";
import { useAppStore } from "@/store/auth-store";
import { userService } from "@/services/user.service";

const ProfileScreen = () => {
  const { appUser, setAppUser } = useAppStore();
  const [loading, setLoading] = React.useState(!appUser); // skip load if cached
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await userService.getProfile();

        setAppUser({
          id: profile.id,
          clerkUserId: profile.clerk_user_id,
          email: profile.email,
          role: profile.role,
        });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [setAppUser]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.label}>ID</Text>
      <Text style={styles.value}>{appUser?.id}</Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{appUser?.email}</Text>

      <Text style={styles.label}>Role</Text>
      <Text style={styles.value}>{appUser?.role}</Text>

      <Text style={styles.label}>Clerk ID</Text>
      <Text style={styles.value}>{appUser?.clerkUserId}</Text>
    </ScrollView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 4,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    color: "#888",
    marginTop: 12,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 16,
    color: "#000",
  },
  error: {
    color: "red",
  },
});
