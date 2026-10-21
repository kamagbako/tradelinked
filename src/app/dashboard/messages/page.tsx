import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GlassCard } from "@/components/ui/GlassCard";
import { MessageThread } from "@/components/ui/MessageThread";
import { requireUser } from "@/lib/auth/guard";
import { markMessagesRead, sendUserMessage } from "@/lib/actions/messages";
import type { Message } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("nav.messages") };
}

export default async function MessagesPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("dashboard");

  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  await markMessagesRead(user.id, "ADMIN");

  async function send(body: string) {
    "use server";
    const formData = new FormData();
    formData.set("body", body);
    const result = await sendUserMessage(formData);
    return { error: result.error, message: result.message };
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{t("messages.heading")}</h1>
        <p className="mt-1 text-sm text-text-muted">{t("messages.intro")}</p>
      </div>

      <GlassCard>
        <MessageThread
          userId={user.id}
          selfSender="USER"
          initialMessages={(data ?? []) as Message[]}
          onSend={send}
          placeholder={t("messages.placeholder")}
          emptyText={t("messages.empty")}
          sendLabel={t("messages.send")}
        />
      </GlassCard>
    </div>
  );
}
