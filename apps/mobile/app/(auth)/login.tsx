import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert("Login failed", error.message);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-4xl font-mono text-ink mb-2 tracking-tight">coldsoup</Text>
        <Text className="text-muted text-base mb-10">Team threads, simply.</Text>

        <TextInput
          className="border border-border rounded-lg px-4 py-3 text-ink text-base mb-3 bg-white"
          placeholder="Email"
          placeholderTextColor="#888780"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
        <TextInput
          className="border border-border rounded-lg px-4 py-3 text-ink text-base mb-6 bg-white"
          placeholder="Password"
          placeholderTextColor="#888780"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        <Pressable
          onPress={handleLogin}
          disabled={loading || !email.trim() || !password.trim()}
          className="bg-ink rounded-lg py-4 items-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          {loading ? (
            <ActivityIndicator color="#F7F6F2" />
          ) : (
            <Text className="text-surface font-semibold text-base">Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
