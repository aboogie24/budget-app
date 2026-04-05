import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../utils/apiClient';
import { colors, spacing, radius, typography, glassEffects } from '../../utils/design-system';
import GradientBackground from '../../components/GradientBackground';
import Markdown from 'react-native-markdown-display';

// ─── Types ─────────────────────────────────────────────────────

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
};

type Conversation = {
  id: string;
  title: string;
  conversation_type: string;
  last_message?: string;
  updated_at: string;
};

// ─── Component ─────────────────────────────────────────────────

export default function AIChatScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showConvoList, setShowConvoList] = useState(true);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Load conversations on focus
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0 || streamingText) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, streamingText]);

  // ─── API Calls ─────────────────────────────────────────────

  async function loadConversations() {
    try {
      setLoading(true);
      const data = await api.get<Conversation[]>('/auth/ai/conversations');
      setConversations(data || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(convoId: string) {
    try {
      const data = await api.get<{ messages: Message[] }>(`/auth/ai/conversations/${convoId}`);
      setMessages(data?.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function createConversation(): Promise<string | null> {
    try {
      const data = await api.post<{ id: string }>('/auth/ai/conversations', {
        title: 'New Conversation',
        conversation_type: 'general',
      });
      return data?.id || null;
    } catch (err) {
      console.error('Failed to create conversation:', err);
      return null;
    }
  }

  async function deleteConversation(convoId: string) {
    try {
      await api.delete(`/auth/ai/conversations/${convoId}`);
      setConversations(prev => prev.filter(c => c.id !== convoId));
      if (activeConvoId === convoId) {
        setActiveConvoId(null);
        setMessages([]);
        setShowConvoList(true);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }

  // ─── Send Message with SSE Streaming ──────────────────────

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setInputText('');

    // Create conversation if needed
    let convoId = activeConvoId;
    if (!convoId) {
      convoId = await createConversation();
      if (!convoId) return;
      setActiveConvoId(convoId);
      setShowConvoList(false);
    }

    // Add user message to UI immediately
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingText('');

    const baseUrl = api.getBaseUrl();
    const session = await getAuthToken();

    // Use XMLHttpRequest for SSE — more reliable in React Native than fetch ReadableStream
    const xhr = new XMLHttpRequest();
    let accumulated = '';
    let lastProcessedIndex = 0;

    const promise = new Promise<void>((resolve, reject) => {
      xhr.open('POST', `${baseUrl}/auth/ai/conversations/${convoId}/messages`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${session}`);

      xhr.onprogress = () => {
        const newData = xhr.responseText.substring(lastProcessedIndex);
        lastProcessedIndex = xhr.responseText.length;

        const lines = newData.split('\n');
        let hasNewText = false;

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            if (event.type === 'text') {
              accumulated += event.text;
              hasNewText = true;
            } else if (event.type === 'error') {
              console.error('Stream error:', event.error);
            }
          } catch {
            // Skip malformed JSON
          }
        }

        if (hasNewText) {
          setStreamingText(accumulated);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 400) {
          reject(new Error(`HTTP ${xhr.status}`));
          return;
        }
        resolve();
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(JSON.stringify({ content: text }));
    });

    try {
      await promise;

      // Add assistant message to the list
      if (accumulated) {
        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: accumulated,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }

      // Refresh conversation list to update titles
      loadConversations();
    } catch (err) {
      console.error('Send message error:', err);
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I had trouble connecting. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsStreaming(false);
      setStreamingText('');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  async function getAuthToken(): Promise<string> {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const json = await AsyncStorage.getItem('budgetAppSession');
    if (json) {
      const session = JSON.parse(json);
      return session?.token || '';
    }
    return '';
  }

  function openConversation(convoId: string) {
    setActiveConvoId(convoId);
    setShowConvoList(false);
    loadMessages(convoId);
  }

  function startNewChat() {
    setActiveConvoId(null);
    setMessages([]);
    setShowConvoList(false);
    setTimeout(() => inputRef.current?.focus(), 300);
  }

  // ─── Render Functions ─────────────────────────────────────

  const mdStyles = StyleSheet.create({
    body: { color: colors.text, fontSize: 15, lineHeight: 22 },
    heading1: { color: '#fff', fontSize: 20, fontWeight: '700' as const, marginTop: 12, marginBottom: 6 },
    heading2: { color: '#fff', fontSize: 18, fontWeight: '700' as const, marginTop: 10, marginBottom: 4 },
    heading3: { color: '#fff', fontSize: 16, fontWeight: '600' as const, marginTop: 8, marginBottom: 4 },
    strong: { color: '#fff', fontWeight: '700' as const },
    em: { color: colors.text, fontStyle: 'italic' as const },
    bullet_list: { marginTop: 4, marginBottom: 4 },
    ordered_list: { marginTop: 4, marginBottom: 4 },
    list_item: { marginBottom: 4, flexDirection: 'row' as const },
    bullet_list_icon: { color: colors.accent, fontSize: 14, marginRight: 6, marginTop: 2 },
    ordered_list_icon: { color: colors.accent, fontSize: 14, marginRight: 6, marginTop: 2 },
    code_inline: { backgroundColor: 'rgba(124,58,237,0.15)', color: colors.accent, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
    fence: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12, marginVertical: 8 },
    code_block: { color: '#e0e0f0', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 12, marginVertical: 6, opacity: 0.9 },
    hr: { backgroundColor: 'rgba(255,255,255,0.1)', height: 1, marginVertical: 12 },
    table: { borderColor: 'rgba(255,255,255,0.1)' },
    th: { backgroundColor: 'rgba(124,58,237,0.1)', padding: 8 },
    td: { padding: 8, borderColor: 'rgba(255,255,255,0.08)' },
    tr: { borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    link: { color: colors.accent, textDecorationLine: 'underline' as const },
    paragraph: { marginTop: 2, marginBottom: 6 },
  });

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color={colors.accent} />
          </View>
        )}
        <View style={[styles.messageContent, isUser ? styles.userContent : styles.aiContent]}>
          {isUser ? (
            <Text style={[styles.messageText, styles.userText]}>{item.content}</Text>
          ) : (
            <Markdown style={mdStyles}>{item.content}</Markdown>
          )}
        </View>
      </View>
    );
  }

  function renderStreamingMessage() {
    if (!isStreaming || !streamingText) return null;
    return (
      <View style={[styles.messageBubble, styles.aiBubble]}>
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={14} color={colors.accent} />
        </View>
        <View style={[styles.messageContent, styles.aiContent]}>
          <Markdown style={mdStyles}>{streamingText}</Markdown>
          <View style={styles.typingDots}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        </View>
      </View>
    );
  }

  function renderConversationItem({ item }: { item: Conversation }) {
    return (
      <TouchableOpacity
        style={styles.convoItem}
        onPress={() => openConversation(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.convoIcon}>
          <Ionicons
            name={item.conversation_type === 'planning' ? 'map' : 'chatbubbles'}
            size={20}
            color={colors.accent}
          />
        </View>
        <View style={styles.convoInfo}>
          <Text style={styles.convoTitle} numberOfLines={1}>{item.title}</Text>
          {item.last_message && (
            <Text style={styles.convoPreview} numberOfLines={1}>{item.last_message}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => deleteConversation(item.id)}
          style={styles.deleteBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // ─── Conversation List View ───────────────────────────────

  if (showConvoList && !activeConvoId) {
    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={styles.container}>
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <View>
              <Text style={styles.headerTitle}>CoupleFlow AI</Text>
              <Text style={styles.headerSubtitle}>Your financial co-pilot</Text>
            </View>
            <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat}>
              <Ionicons name="add" size={22} color={colors.text} />
              <Text style={styles.newChatText}>New Chat</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            {[
              { icon: 'trending-down' as const, label: 'Pay off debt', type: 'planning' },
              { icon: 'shield-checkmark' as const, label: 'Emergency fund', type: 'planning' },
              { icon: 'airplane' as const, label: 'Plan a trip', type: 'planning' },
              { icon: 'help-circle' as const, label: 'Ask anything', type: 'general' },
            ].map((action, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickAction}
                onPress={() => {
                  startNewChat();
                  setTimeout(() => setInputText(action.label === 'Ask anything' ? '' : `Help us ${action.label.toLowerCase()}`), 300);
                }}
              >
                <Ionicons name={action.icon} size={20} color={colors.accent} />
                <Text style={styles.quickActionText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Conversation History */}
          <View style={styles.convoListHeader}>
            <Text style={styles.sectionTitle}>Recent Conversations</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyDesc}>
                Start a new chat to get personalized financial advice for you and your partner.
              </Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              renderItem={renderConversationItem}
              contentContainerStyle={styles.convoList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ─── Chat View ────────────────────────────────────────────

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowConvoList(true);
                setActiveConvoId(null);
                setMessages([]);
                loadConversations();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <Ionicons name="sparkles" size={16} color={colors.accent} />
              <Text style={styles.chatHeaderTitle}>CoupleFlow AI</Text>
            </View>
            <TouchableOpacity onPress={startNewChat}>
              <Ionicons name="add-circle-outline" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.welcomeState}>
                <View style={styles.welcomeIcon}>
                  <Ionicons name="sparkles" size={32} color={colors.accent} />
                </View>
                <Text style={styles.welcomeTitle}>What can I help with?</Text>
                <Text style={styles.welcomeDesc}>
                  Ask me about your budget, debt payoff plans, savings goals, or anything financial.
                </Text>
              </View>
            }
            ListFooterComponent={renderStreamingMessage}
          />

          {/* Streaming indicator */}
          {isStreaming && !streamingText && (
            <View style={styles.thinkingBar}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.thinkingText}>Thinking...</Text>
            </View>
          )}

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Ask CoupleFlow AI..."
              placeholderTextColor={colors.textDark}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
              editable={!isStreaming}
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || isStreaming) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isStreaming}
            >
              <Ionicons
                name="arrow-up-circle"
                size={32}
                color={inputText.trim() && !isStreaming ? colors.accent : colors.textDark}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.glassMedium,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  newChatText: {
    ...typography.smallBold,
    color: colors.text,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.glassLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  quickActionText: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Conversation List
  convoListHeader: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.smallBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  convoList: {
    paddingHorizontal: spacing.lg,
  },
  convoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 8,
  },
  convoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  convoInfo: {
    flex: 1,
  },
  convoTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  convoPreview: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  emptyDesc: {
    ...typography.body,
    color: colors.textDark,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  // Chat Header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatHeaderTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },

  // Messages
  messageList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: 8,
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  aiBubble: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  messageContent: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    padding: 14,
  },
  userContent: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
    marginLeft: 'auto',
  },
  aiContent: {
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  typingDots: {
    marginTop: 6,
    alignItems: 'flex-start',
  },

  // Welcome State
  welcomeState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  welcomeTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  welcomeDesc: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Thinking indicator
  thinkingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  thinkingText: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  textInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    minHeight: 42,
  },
  sendBtn: {
    padding: 4,
    marginBottom: 1,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
