import { Button } from "@ridex/ui-web";
import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">403 — Không có quyền</h1>
      <p className="text-surface-700 dark:text-surface-300">
        Tài khoản này không có quyền truy cập Admin Console. Vui lòng đăng nhập bằng tài khoản
        có vai trò <code className="rounded bg-surface-100 px-1 dark:bg-surface-800">ADMIN</code>.
      </p>
      <Button asChild>
        <Link href="/login">Quay lại đăng nhập</Link>
      </Button>
    </section>
  );
}
