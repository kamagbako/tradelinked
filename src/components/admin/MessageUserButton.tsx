"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MobileDrawer } from "@/components/ui/MobileDrawer";
import { MessageThread } from "@/components/ui/MessageThread";
import { getMessageThread, markMessagesRead, sendAdminMessage } from "@/lib/actions/messages";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MessageUserButton({
  userId,
  label,
  initialUnread = 0,
}: {
  userId: string;
  label: string;
  initialUnread?: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);

  async function handleOpen() {
    setOpen(true);
    if (messages !== null) return;

    setLoading(true);
    const result = await getMessageThread(userId);
    if (result.error) {
      setError(result.error);
    } else {
      setMessages(result.messages ?? []);
      if (unread > 0) {
        setUnread(0);
        await markMessagesRead(userId, "USER");
      }
    }
    setLoading(false);
  }

  function send(body: string) {
    return sendAdminMessage(userId, body);
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={handleOpen} className="relative">
        <MessageSquare className="h-4 w-4" />
        Message
        {unread > 0 && (
          <span
            className={cn(
              "flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white",
            )}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      <MobileDrawer open={open} onClose={() => setOpen(false)} title={label}>
        {loading && <p className="py-8 text-center text-sm text-text-muted">Loading messages…</p>}
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        {!loading && !error && messages !== null && (
          <MessageThread
            userId={userId}
            selfSender="ADMIN"
            initialMessages={messages}
            onSend={send}
            placeholder="Type a message…"
            emptyText="No messages with this user yet."
            sendLabel="Send message"
          />
        )}
      </MobileDrawer>
    </>
  );
}
