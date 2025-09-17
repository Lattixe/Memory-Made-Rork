import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { memoryMadeColors } from '@/constants/colors';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup?: (email: string, password: string, name?: string) => Promise<void>;
}

export default function LoginForm({ onLogin, onSignup }: LoginFormProps) {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const canSubmit = useMemo(() => {
    if (mode === 'signup') return email.includes('@') && password.length >= 6;
    return email.includes('@') && password.length > 0;
  }, [email, password, mode]);

  const handleLogin = async () => {
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) {
      Alert.alert('Required Fields', 'Please enter both your email and password.');
      return;
    }
    if (!e.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await onLogin(e, p);
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Failed to log in. Please try again.';
      if (message.toLowerCase().includes('invalid')) {
        Alert.alert(
          'Invalid email or password',
          'If you are new, create an account first.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Create Account', onPress: () => setMode('signup') },
          ]
        );
      } else {
        Alert.alert('Login Error', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!onSignup) return;
    const e = email.trim();
    const p = password.trim();
    const n = name.trim() || undefined;
    if (!e || !p) {
      Alert.alert('Required Fields', 'Enter email and password to sign up.');
      return;
    }
    if (!e.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (p.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    try {
      await onSignup(e, p, n);
    } catch (e) {
      Alert.alert('Signup Error', 'Failed to sign up.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image 
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/8w88xv9hou5yn3a6v4iwc' }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            testID="auth-toggle-login"
            onPress={() => setMode('login')}
            style={[styles.toggleButton, mode === 'login' && styles.toggleButtonActive]}
            disabled={isLoading}
          >
            <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="auth-toggle-signup"
            onPress={() => setMode('signup')}
            style={[styles.toggleButton, mode === 'signup' && styles.toggleButtonActive]}
            disabled={isLoading}
          >
            <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {mode === 'signup' && (
            <TextInput
              testID="name-input"
              style={styles.input}
              placeholder="Name (optional)"
              placeholderTextColor={memoryMadeColors.text.tertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!isLoading}
              returnKeyType="next"
              selectionColor={memoryMadeColors.primary}
              underlineColorAndroid="transparent"
              autoCorrect={false}
              spellCheck={false}
            />
          )}

          <TextInput
            testID="email-input"
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={memoryMadeColors.text.tertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isLoading}
            returnKeyType="next"
            selectionColor={memoryMadeColors.primary}
            underlineColorAndroid="transparent"
            autoCorrect={false}
            spellCheck={false}
          />

          <TextInput
            testID="password-input"
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={memoryMadeColors.text.tertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'password'}
            editable={!isLoading}
            returnKeyType={mode === 'signup' ? 'next' : 'done'}
            onSubmitEditing={mode === 'signup' ? undefined : handleLogin}
            selectionColor={memoryMadeColors.primary}
            underlineColorAndroid="transparent"
            autoCorrect={false}
            spellCheck={false}
          />

          {mode === 'login' ? (
            <TouchableOpacity
              testID="login-button"
              style={[styles.primaryButton, (!canSubmit || isLoading) && styles.primaryButtonDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit || isLoading}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color={memoryMadeColors.white} />
                  <Text style={styles.primaryButtonText}>Logging In...</Text>
                </>
              ) : (
                <Text style={styles.primaryButtonText}>Log In</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="signup-button"
              style={[styles.outlineButton, (!canSubmit || isLoading) && styles.outlineButtonDisabled]}
              onPress={handleSignup}
              disabled={!canSubmit || isLoading}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color={memoryMadeColors.primary} />
                  <Text style={styles.outlineButtonText}>Creating Account...</Text>
                </>
              ) : (
                <Text style={styles.outlineButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          )}

          {mode === 'login' && (
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <View style={styles.orContainer}>
            <Text style={styles.orText}>or continue with</Text>
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton}>
              <Text style={styles.socialIcon}>G</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Text style={styles.socialIcon}>f</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: memoryMadeColors.cream,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'flex-start',
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 600,
    height: 160,
    maxWidth: '100%',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: memoryMadeColors.white,
    borderWidth: 1,
    borderColor: memoryMadeColors.border,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  toggleButtonActive: {
    borderColor: memoryMadeColors.primary,
  },
  toggleText: {
    color: memoryMadeColors.text.secondary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  toggleTextActive: {
    color: memoryMadeColors.primary,
  },
  form: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  input: {
    backgroundColor: memoryMadeColors.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: memoryMadeColors.primary,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: memoryMadeColors.text.primary,
    minHeight: 56,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  primaryButton: {
    backgroundColor: memoryMadeColors.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: memoryMadeColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: memoryMadeColors.white,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: memoryMadeColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  outlineButtonDisabled: {
    opacity: 0.6,
  },
  outlineButtonText: {
    color: memoryMadeColors.primary,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    color: memoryMadeColors.text.secondary,
    fontSize: 14,
  },
  orContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  orText: {
    color: memoryMadeColors.text.secondary,
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: memoryMadeColors.white,
    borderWidth: 2,
    borderColor: memoryMadeColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIcon: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: memoryMadeColors.text.primary,
  },
});