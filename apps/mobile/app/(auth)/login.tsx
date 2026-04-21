import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F2EFE8" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: 40 }}>
          <Text style={{ fontFamily: "monospace", fontSize: 24, fontWeight: "600", color: "#1A1A18", letterSpacing: -0.5 }}>
            coldsoup
          </Text>
          <Text style={{ fontSize: 14, color: "#6B6A65", marginTop: 4 }}>
            Threads. Groups. Status. Nothing else.
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <View>
            <Text style={{ fontFamily: "monospace", fontSize: 10, fontWeight: "500", color: "#6B6A65", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
              Email address
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#E2DDD2", backgroundColor: "#F7F4ED", paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: "#1A1A18" }}
              placeholder="you@example.com"
              placeholderTextColor="#6B6A65"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View>
            <Text style={{ fontFamily: "monospace", fontSize: 10, fontWeight: "500", color: "#6B6A65", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
              Password
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#E2DDD2", backgroundColor: "#F7F4ED", paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: "#1A1A18" }}
              placeholder="••••••••"
              placeholderTextColor="#6B6A65"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          {error && (
            <View style={{ borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FEF2F2", paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, color: "#DC2626" }}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={loading || !email.trim() || !password.trim()}
            style={({ pressed }) => ({
              backgroundColor: "#1A1A18",
              paddingVertical: 12,
              alignItems: "center",
              opacity: pressed || loading || !email.trim() || !password.trim() ? 0.4 : 1,
            })}
          >
            {loading ? (
              <ActivityIndicator color="#F2EFE8" />
            ) : (
              <Text style={{ fontFamily: "monospace", fontSize: 13, fontWeight: "500", color: "#F2EFE8" }}>
                Sign in
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
