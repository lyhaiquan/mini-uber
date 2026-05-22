"use client";

import { Button } from "@ridex/ui-web";
import * as React from "react";


export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Đã có lỗi xảy ra</h1>
      <p className="text-surface-700 dark:text-surface-300">
        Vui lòng thử lại. Nếu lỗi vẫn tiếp diễn, liên hệ hỗ trợ.
      </p>
      <Button onClick={reset}>Thử lại</Button>
    </section>
  );
}
