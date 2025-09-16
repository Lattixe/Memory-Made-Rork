import React, { useState } from 'react';
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
  onSignup?: (email: string, password: string) => Promise<void>;
}

export default function LoginForm({ onLogin, onSignup }: LoginFormProps) {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter both your email and password.');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await onLogin(email.trim(), password.trim());
    } catch (error) {
      Alert.alert('Login Error', 'Failed to log in. Please try again.');
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

        <View style={styles.form}>
          <TextInput
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
            onSubmitEditing={() => {}}
            selectionColor={memoryMadeColors.primary}
            underlineColorAndroid="transparent"
            autoCorrect={false}
            spellCheck={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={memoryMadeColors.text.tertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            autoComplete="password"
            editable={!isLoading}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            selectionColor={memoryMadeColors.primary}
            underlineColorAndroid="transparent"
            autoCorrect={false}
            spellCheck={false}
          />

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <ActivityIndicator size="small" color={memoryMadeColors.white} />
                <Text style={styles.loginButtonText}>Logging In...</Text>
              </>
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signUpButton} onPress={async () => {
            if (!onSignup) return;
            if (!email.trim() || !password.trim()) {
              Alert.alert('Required Fields', 'Enter email and password to sign up.');
              return;
            }
            setIsLoading(true);
            try {
              await onSignup(email.trim(), password.trim());
            } catch (e) {
              Alert.alert('Signup Error', 'Failed to sign up.');
            } finally {
              setIsLoading(false);
            }
          }}>
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </TouchableOpacity>

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
    marginBottom: 24,
  },
  logo: {
    width: 600,
    height: 200,
    maxWidth: '100%',
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
  loginButton: {
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
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: memoryMadeColors.white,
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
  signUpButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: memoryMadeColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  signUpButtonText: {
    color: memoryMadeColors.primary,
    fontSize: 18,
    fontWeight: '600' as const,
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