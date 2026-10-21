"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { runAction } from "@/lib/errors";
import type { Message, MessageSender } from "@/lib/types";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export interface SendMessageResult extends ActionResult {
  message?: Message;
}

const MAX_BODY_LENGTH = 4000;

async function sendUserMessageImpl(formData: FormData): Promise<SendMessageResult> {
  const t = await getTranslations("dashboard");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: t("errors.messageBody") };
  if (body.length > MAX_BODY_LENGTH) return { error: t("errors.messageTooLong") };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: t("errors.signedIn") };

  const { data, error } = await supabase
    .from("messages")
    .insert({ user_id: userData.user.id, sender: "USER", sender_id: userData.user.id, body })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/messages");
  return { success: true, message: data as Message };
}

// The admin panel is English-only, so these messages aren't run through next-intl.
async function sendAdminMessageImpl(userId: string, body: string): Promise<SendMessageResult> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Message can't be empty." };
  if (trimmed.length > MAX_BODY_LENGTH) {
    return { error: `Message can't be longer than ${MAX_BODY_LENGTH} characters.` };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in." };

  const { data, error } = await supabase
    .from("messages")
    .insert({ user_id: userId, sender: "ADMIN", sender_id: userData.user.id, body: trimmed })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true, message: data as Message };
}

async function markMessagesReadImpl(userId: string, fromSender: MessageSender): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("sender", fromSender)
    .is("read_at", null);

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/users");
  return { success: true };
}

export interface ThreadResult {
  messages?: Message[];
  error?: string;
}

async function getMessageThreadImpl(userId: string): Promise<ThreadResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };

  return { messages: (data ?? []) as Message[] };
}

export async function sendUserMessage(formData: FormData): Promise<SendMessageResult> {
  return runAction("messages.sendUser", () => sendUserMessageImpl(formData));
}

export async function sendAdminMessage(userId: string, body: string): Promise<SendMessageResult> {
  return runAction("messages.sendAdmin", () => sendAdminMessageImpl(userId, body));
}

export async function markMessagesRead(userId: string, fromSender: MessageSender): Promise<ActionResult> {
  return runAction("messages.markRead", () => markMessagesReadImpl(userId, fromSender));
}

export async function getMessageThread(userId: string): Promise<ThreadResult> {
  return runAction("messages.getThread", () => getMessageThreadImpl(userId));
}
