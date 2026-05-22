import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Không tìm thấy trang</h1>
      <p className="text-surface-700 dark:text-surface-300">
        Trang bạn cần có thể đã được di chuyển hoặc chưa được tạo.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
      >
        Về trang chủ
      </Link>
    </section>
  );
}
