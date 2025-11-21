import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string | null;
};

class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message ?? "Something went wrong",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[AppErrorBoundary] error", error);
    console.error("[AppErrorBoundary] info", info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback} testID="app-error-boundary">
          <View style={styles.card}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>{this.state.errorMessage}</Text>
            <Pressable style={styles.button} onPress={this.handleRetry} testID="error-retry-button">
              <Text style={styles.buttonText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#080B12",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#111827",
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8FAFC",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: "#CBD5F5",
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: "#38BDF8",
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#021424",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AppErrorBoundary;
