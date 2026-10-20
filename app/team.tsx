import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ArrowLeft, Users } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { showDialog, showToast } from "../components/app-feedback";
import { friendlyError } from "../constants/network-error";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";

type BusinessMember = {
  member_id?: string;
  member_role: string;
  member_name: string | null;
  email?: string;
  joined_at: string;
};

async function fetchBusinessMembers(role: "owner" | "worker") {
  const { data, error } =
    role === "owner"
      ? await supabase.rpc("list_business_members")
      : await supabase.rpc("list_team");
  if (error) throw error;
  if (role === "owner") return data ?? [];
  return (data ?? []).map((member: {
    member_role: string;
    member_name: string | null;
    joined_at: string;
  }) => ({
    member_role: member.member_role,
    member_name: member.member_name,
    joined_at: member.joined_at,
  }));
}

export default function TeamScreen() {
  const { colors } = useTheme();
  const { businessId, role } = useAuth();
  const isOwner = role === "owner";
  const isWorker = role === "worker";
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (role !== "owner" && role !== "worker") return;

    setRefreshing(true);
    try {
      setMembers(await fetchBusinessMembers(role));
    } catch (error) {
      showToast(
        "Couldn't load team",
        friendlyError(error, "Please try again."),
      );
    } finally {
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => {
    if (role !== "owner" && role !== "worker") {
      return;
    }
    let isActive = true;

    fetchBusinessMembers(role)
      .then((nextMembers) => {
        if (isActive) setMembers(nextMembers);
      })
      .catch((error: unknown) => {
        if (isActive) {
          showToast(
            "Couldn't load team",
            friendlyError(error, "Please try again."),
          );
        }
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [role]);

  const createInvite = async () => {
    setCreatingInvite(true);
    try {
      const savedSettings = await AsyncStorage.getItem("business_settings");
      const settings: { businessName?: unknown } = savedSettings ? JSON.parse(savedSettings) : {};
      const businessName =
        typeof settings.businessName === "string" ? settings.businessName.trim() : "";
      if (!businessName) {
        showToast(
          "Business name required",
          "Set your business name in Settings before creating an invite.",
        );
        return;
      }

      const { data, error } = await supabase.rpc("create_invite", {
        p_business_name: businessName,
      });
      if (error) throw error;
      if (typeof data !== "string") {
        showToast("Couldn't create invite", "The server returned an invalid invite code.");
        return;
      }

      const compactCode = data.replace(/-/g, "").toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(compactCode)) {
        showToast("Couldn't create invite", "The server returned an invalid invite code.");
        return;
      }

      const inviteCode = `${compactCode.slice(0, 5)}-${compactCode.slice(5)}`;
      const shareMessage = `Join my business on TradeApp with this code: ${inviteCode}. It expires in 48 hours`;
      showDialog(
        "Invite code",
        `${inviteCode}\n\nExpires in 48 hours, single use.\n\nCodes cannot be retrieved later. If this code is lost, create a new one.`,
        [
          {
            text: "Copy",
            onPress: async () => {
              try {
                await Clipboard.setStringAsync(inviteCode);
                showToast("Copied", "Invite code copied to clipboard.");
              } catch (error) {
                showToast(
                  "Couldn't copy code",
                  friendlyError(error, "Please try again."),
                );
              }
            },
          },
          {
            text: "Share",
            onPress: async () => {
              try {
                await Share.share({ message: shareMessage });
              } catch (error) {
                showToast(
                  "Couldn't share code",
                  friendlyError(error, "Please try again."),
                );
              }
            },
          },
          { text: "Done", style: "cancel" },
        ],
      );
    } catch (error) {
      showToast(
        "Couldn't create invite",
        friendlyError(error, "Please try again."),
      );
    } finally {
      setCreatingInvite(false);
    }
  };

  const removeMember = async (member: BusinessMember) => {
    if (!businessId || !member.member_id || member.member_role !== "worker") return;

    setRemovingMemberId(member.member_id);
    try {
      const { error } = await supabase
        .from("business_members")
        .delete()
        .eq("business_id", businessId)
        .eq("user_id", member.member_id);
      if (error) throw error;
      showToast("Worker removed");
      await loadMembers();
    } catch (error) {
      showToast(
        "Couldn't remove worker",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setRemovingMemberId(null);
    }
  };

  const confirmRemoveMember = (member: BusinessMember) => {
    showDialog(
      "Remove worker?",
      `Remove ${member.email} from this business?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void removeMember(member),
        },
      ],
    );
  };

  if (!isOwner && !isWorker) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.message, { color: colors.text }]}>
          Team management is available to the business owner only.
        </Text>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Team</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadMembers()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {isOwner ? <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Invite a worker</Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            Create a single-use code that expires in 48 hours. The code cannot be retrieved after you close it.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => void createInvite()}
            disabled={creatingInvite}
          >
            {creatingInvite ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
                Create invite code
              </Text>
            )}
          </TouchableOpacity>
        </View> : null}

        <View style={styles.membersHeader}>
          <View style={styles.membersTitleRow}>
            <Users size={20} color={colors.secondary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
          </View>
          <Text style={[styles.memberCount, { color: colors.textMuted }]}>
            {members.length}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : members.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.bodyText, { color: colors.textMuted }]}>No team members found.</Text>
          </View>
        ) : (
          <View style={[styles.memberList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {members.map((member, index) => (
              <View
                key={member.member_id ?? `${member.member_role}-${member.joined_at}-${index}`}
                style={[
                  styles.memberRow,
                  index < members.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={styles.memberDetails}>
                  <Text style={[styles.memberName, { color: colors.text }]}>
                    {isOwner && member.member_role === "owner"
                      ? "You"
                      : member.member_name?.trim() || member.email || member.member_role}
                  </Text>
                  {isOwner && member.email ? (
                    <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                      {member.email}
                    </Text>
                  ) : null}
                  <Text style={[styles.memberMeta, { color: colors.textMuted }]}>
                    {member.member_role} · Joined {new Date(member.joined_at).toLocaleDateString()}
                  </Text>
                </View>
                {isOwner && member.member_role === "worker" ? (
                  <TouchableOpacity
                    style={[styles.removeButton, { borderColor: colors.danger }]}
                    onPress={() => confirmRemoveMember(member)}
                    disabled={removingMemberId === member.member_id}
                  >
                    {removingMemberId === member.member_id ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Text style={[styles.removeButtonText, { color: colors.danger }]}>Remove</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", marginLeft: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  infoCard: { borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  bodyText: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  primaryButton: { alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: 12, marginTop: 18 },
  primaryButtonText: { fontSize: 15, fontWeight: "700" },
  membersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  membersTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  memberCount: { fontSize: 13, fontWeight: "600" },
  loader: { marginTop: 28 },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 18 },
  memberList: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  memberRow: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  memberDetails: { flex: 1, paddingRight: 12 },
  memberEmail: { fontSize: 13, marginTop: 4 },
  memberName: { fontSize: 14, fontWeight: "600" },
  memberMeta: { fontSize: 12, marginTop: 4, textTransform: "capitalize" },
  removeButton: { minHeight: 36, justifyContent: "center", borderWidth: 1, borderRadius: 9, paddingHorizontal: 12 },
  removeButtonText: { fontSize: 13, fontWeight: "700" },
  message: { textAlign: "center", fontSize: 16, lineHeight: 24 },
  secondaryButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderRadius: 10 },
  secondaryButtonText: { fontSize: 14, fontWeight: "600" },
});
