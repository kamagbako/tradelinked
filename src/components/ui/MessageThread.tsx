"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { subscribeToTable } from "@/lib/supabase/realtime";
import { formatDate } from "@/lib/utils";
import type { Message, MessageSender } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageThreadProps {
  /** The user this thread belongs to (on both the dashboard page and the admin drawer). */
  userId: string;
  /** Which side of the conversation this viewer is — their own messages render on the right. */
  selfSender: MessageSender;
  initialMessages: Message[];
  onSend: (body: string) => Promise<{ error?: string; message?: Message }>;
  placeholder: string;
  emptyText: string;
  sendLabel: string;
  className?: string;
}

export function MessageThread({
  userId,
  selfSender,
  initialMessages,
  onSend,
  placeholder,
  emptyText,
  sendLabel,
  className,
}: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  // Realtime carries the other party's replies in live; our own sends are appended directly
  // from onSend's result below, so this ignores echoes of messages we sent ourselves.
  useEffect(() => {
    return subscribeToTable<Message>(
      `message-thread-${userId}`,
      { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.new.sender === selfSender) return;
        setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
      },
    );
  }, [userId, selfSender]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || isPending) return;

    startTransition(async () => {
      const result = await onSend(trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setBody("");
      if (result.message) {
        setMessages((prev) => (prev.some((m) => m.id === result.message!.id) ? prev : [...prev, result.message!]));
      }
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        ref={scrollRef}
        className="flex max-h-[28rem] min-h-[16rem] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-bg p-4"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-text-muted">{emptyText}</p>
        ) : (
          messages.map((message) => {
            const mine = message.sender === selfSender;
            return (
              <div key={message.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm",
                    mine
                      ? "rounded-br-md bg-blue-500 text-white"
                      : "rounded-bl-md border border-border bg-surface text-text",
                  )}
                >
                  {message.body}
                </div>
                <span className="mt-1 text-[11px] text-text-muted">{formatDate(message.created_at)}</span>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          rows={1}
          className="min-h-[44px] flex-1 resize-none py-2.5"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" isLoading={isPending} disabled={!body.trim()} aria-label={sendLabel}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
