"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/* Route-level error boundary. Without one, an unhandled render error shows
   Next's default page — unstyled, English, and alarming to a customer. */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");

  useEffect(() => {
    // The digest is what correlates this with the server log; the message
    // itself may contain data that should not be in a browser console.
    console.error("[render] failed", error.digest);
  }, [error]);

  return (
    <div className="min-h-screen bg-porcelain grid place-items-center px-4">
      <EmptyState
        icon="alert-circle"
        title={t("title")}
        description={t("desc")}
        action={
          <Button variant="primary" size="lg" onClick={reset}>
            {t("cta")}
          </Button>
        }
      />
    </div>
  );
}
