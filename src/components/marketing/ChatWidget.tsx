"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { MessageCircle, MessageSquare, Send, TrendingUp, X } from "lucide-react";
import { LogoIcon } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
  handoff?: string;
}

const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_URL;

function whatsappLink(text: string) {
  if (!WHATSAPP_URL) return null;
  return `${WHATSAPP_URL}${WHATSAPP_URL.includes("?") ? "&" : "?"}text=${encodeURIComponent(text)}`;
}

// Topic ids are message keys under landing.chat.topics.<id>; only "person" hands off to WhatsApp.
const TOPICS = [
  { id: "deposit", handoff: false },
  { id: "withdraw", handoff: false },
  { id: "plans", handoff: false },
  { id: "person", handoff: true },
] as const;

export function ChatWidget({ className }: { className?: string }) {
  const t = useTranslations("landing.chat");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, from: "bot", text: t("greeting") }]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function reply(userText: string, botText: string, handoff?: string) {
    setMessages((prev) => [...prev, { id: nextId.current++, from: "user", text: userText }]);
    setTyping(true);
    timers.current.push(
      setTimeout(() => {
        setTyping(false);
        setMessages((prev) => [...prev, { id: nextId.current++, from: "bot", text: botText, handoff }]);
      }, 700),
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    reply(
      text,
      whatsappLink(text)
        ? t("replyWhatsApp")
        : t("replyLogin"),
      text,
    );
  }

  return (
    <div className={cn("fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t("dialogLabel")}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 140 }}
            style={{ transformOrigin: "bottom right" }}
            className="absolute bottom-16 right-0 flex h-[min(520px,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            <div className="flex flex-col items-center gap-1 border-b border-border bg-gradient-to-b from-emerald-500/15 to-transparent px-5 py-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <LogoIcon className="h-7 w-7" />
              </span>
              <p className="text-sm font-semibold text-text">{t("title")}</p>
              <p className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t("replyTime")}
              </p>
            </div>

            <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => {
                const link = m.handoff ? whatsappLink(m.handoff) : null;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex max-w-[85%] flex-col gap-2", m.from === "user" ? "items-end self-end" : "items-start")}
                  >
                    <p
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm",
                        m.from === "user" ? "bg-blue-500 text-white" : "bg-hover text-text",
                      )}
                    >
                      {m.text}
                    </p>
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-medium text-white hover:bg-emerald-600"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {t("continueWhatsApp")}
                      </a>
                    )}
                  </motion.div>
                );
              })}

              {typing && (
                <div className="flex w-fit items-center gap-1 rounded-2xl bg-hover px-4 py-3" aria-label={t("typing")}>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-text-muted"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              )}

              {messages.length === 1 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {TOPICS.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() =>
                        reply(
                          t(`topics.${topic.id}.label`),
                          t(`topics.${topic.id}.answer`),
                          topic.handoff ? t(`topics.${topic.id}.handoff`) : undefined,
                        )
                      }
                      className="min-h-[36px] rounded-full border border-border px-3 text-xs text-text hover:border-blue-500/60 hover:bg-hover"
                    >
                      {t(`topics.${topic.id}.label`)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("placeholder")}
                aria-label={t("inputLabel")}
                className="min-h-[44px] flex-1 rounded-xl border border-border bg-bg px-3.5 text-sm text-text placeholder:text-text-muted focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label={t("send")}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 text-white transition-opacity disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label={open ? t("close") : t("open")}
        aria-expanded={open}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "close" : "open"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
