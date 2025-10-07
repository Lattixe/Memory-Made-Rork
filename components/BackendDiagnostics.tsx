import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { neutralColors } from '@/constants/colors';
import { trpcClient } from '@/lib/trpc';

type DiagnosticResult = {
  endpoint: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  data?: any;
};

export default function BackendDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const DEFAULT_RORK_BASE_URL = 'https://dev-m7gyp7dzka89rw149zpa5.rorktest.dev' as const;

  const getBaseUrl = () => {
    if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
      return (process.env.EXPO_PUBLIC_RORK_API_BASE_URL as string).replace(/\/$/, '');
    }
    return DEFAULT_RORK_BASE_URL;
  };

  const runDiagnostics = React.useCallback(async () => {
    setIsRunning(true);
    const baseUrl = getBaseUrl();
    const diagnostics: DiagnosticResult[] = [];

    console.log('🔍 Starting backend diagnostics...');
    console.log('Base URL:', baseUrl);

    if (!baseUrl) {
      diagnostics.push({
        endpoint: 'Base URL',
        status: 'error',
        message: 'No base URL configured. Set EXPO_PUBLIC_RORK_API_BASE_URL.',
      });
      setResults(diagnostics);
      setIsRunning(false);
      return;
    }

    diagnostics.push({
      endpoint: 'Base URL',
      status: 'success',
      message: baseUrl,
    });

    const endpoints = [
      { path: '/api/', name: 'Health Check' },
      { path: '/api/debug', name: 'Debug Info' },
      { path: '/api/test-openai', name: 'OpenAI Config' },
      { path: '/api/test-replicate', name: 'Replicate Config' },
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Testing ${endpoint.name}: ${baseUrl}${endpoint.path}`);
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          diagnostics.push({
            endpoint: endpoint.name,
            status: 'success',
            message: `✅ ${response.status} OK`,
            data,
          });
          console.log(`✅ ${endpoint.name} passed:`, data);
        } else {
          diagnostics.push({
            endpoint: endpoint.name,
            status: 'error',
            message: `❌ ${response.status} ${response.statusText}`,
          });
          console.error(`❌ ${endpoint.name} failed:`, response.status);
        }
      } catch (error: any) {
        diagnostics.push({
          endpoint: endpoint.name,
          status: 'error',
          message: `❌ ${error.message}`,
        });
        console.error(`❌ ${endpoint.name} error:`, error);
      }
    }

    try {
      console.log('Testing tRPC connection...');
      const trpcResult = await trpcClient.example.hi.mutate({ name: 'test' });
      diagnostics.push({
        endpoint: 'tRPC Connection',
        status: 'success',
        message: '✅ tRPC is working',
        data: trpcResult,
      });
      console.log('✅ tRPC connection passed:', trpcResult);
    } catch (error: any) {
      diagnostics.push({
        endpoint: 'tRPC Connection',
        status: 'error',
        message: `❌ ${error.message}`,
      });
      console.error('❌ tRPC connection error:', error);
    }

    setResults(diagnostics);
    setIsRunning(false);
    console.log('🔍 Diagnostics complete');
  }, []);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Backend Diagnostics</Text>
      <Text style={styles.subtitle}>
        Check backend connectivity and API configuration
      </Text>
      
      {isRunning && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={neutralColors.primary} />
          <Text style={styles.loadingText}>Running diagnostics...</Text>
        </View>
      )}

      {results.map((result, index) => (
        <View key={index} style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <Text style={styles.endpoint}>{result.endpoint}</Text>
            <View style={[
              styles.statusBadge,
              result.status === 'success' ? styles.successBadge : styles.errorBadge
            ]}>
              <Text style={styles.statusText}>
                {result.status === 'success' ? '✅' : '❌'}
              </Text>
            </View>
          </View>
          <Text style={styles.message}>{result.message}</Text>
          {result.data && (
            <ScrollView horizontal style={styles.dataScroll}>
              <Text style={styles.data}>{JSON.stringify(result.data, null, 2)}</Text>
            </ScrollView>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={styles.button}
        onPress={runDiagnostics}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Running...' : 'Run Diagnostics Again'}
        </Text>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>⚠️ Setup Required</Text>
        <Text style={styles.infoText}>
          If OpenAI Config shows &quot;missing&quot;, you need to set the OPENAI_API_KEY environment variable in your Rork project settings (server-side).
        </Text>
        <Text style={styles.infoText}>
          After setting it, restart the development server and run diagnostics again.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 8,
    color: neutralColors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: neutralColors.text.secondary,
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: neutralColors.text.secondary,
  },
  resultContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  endpoint: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  successBadge: {
    backgroundColor: '#d4edda',
  },
  errorBadge: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  message: {
    fontSize: 14,
    color: neutralColors.text.secondary,
    marginBottom: 4,
  },
  dataScroll: {
    marginTop: 8,
  },
  data: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: neutralColors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  infoBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#856404',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 8,
    lineHeight: 20,
  },
});
