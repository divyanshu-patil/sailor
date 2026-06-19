import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import React from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth-store";
import useAuthenticated from "@/hooks/use-authenticated";
import ClearStorageButton from "@/components/dev/clear-storage-button";

const Home = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isAuthenticated = useAuthenticated();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/(unauthenticated)/login" as any);
        },
      },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to Sailor</Text>
        <Text style={styles.subtitle}>Please login to continue</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/login" as any)}
        >
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Welcome, {user?.name || "User"}!</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
      <ClearStorageButton />
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
  },
  email: {
    fontSize: 14,
    color: "#999",
    marginBottom: 32,
  },
  primaryButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#208AEF",
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  logoutButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ff3b30",
    alignItems: "center",
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
