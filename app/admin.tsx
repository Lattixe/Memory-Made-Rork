import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Settings } from "lucide-react-native";
import { neutralColors as colors } from "@/constants/colors";

export default function AdminSettings() {
  const insets = useSafeAreaInsets();



  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Settings size={24} color={colors.primary} />
            <Text style={styles.title}>Admin Settings</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Panel</Text>
            <Text style={styles.helpText}>
              Admin settings and configuration options will appear here.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: colors.text.primary,
    marginLeft: 10,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },

  helpText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 12,
    lineHeight: 20,
  },
});