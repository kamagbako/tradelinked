"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { setTheme, syncThemeColor, useTheme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("common");
  const theme = useTheme();

  useEffect(() => {
    syncThemeColor();
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full text-text-muted hover:bg-hover hover:text-text",
        className,
      )}
      aria-label={t("toggleTheme")}
      title={t("toggleThemeTitle")}
    >
      {/* Both icons are in the DOM; CSS picks one from data-theme so there is no hydration flicker. */}
      <Sun className="h-5 w-5 light:hidden" />
      <Moon className="hidden h-5 w-5 light:block" />
    </button>
  );
}
