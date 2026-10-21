import Link from "next/link";
import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";

export default async function NotFound() {
  const t = await getTranslations("common.notFound");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="glass-card flex max-w-md flex-col items-center gap-4 rounded-2xl p-10 text-center">
        <Compass className="h-10 w-10 text-blue-500" />
        <p className="text-5xl font-bold text-text">404</p>
        <div>
          <h1 className="font-medium text-text">{t("title")}</h1>
          <p className="mt-1 text-sm text-text-muted">{t("description")}</p>
        </div>
        <Link href="/">
          <Button>{t("backHome")}</Button>
        </Link>
      </div>
    </div>
  );
}
