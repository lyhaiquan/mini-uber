export default function ForbiddenPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">403 - Khong co quyen</h1>
      <p className="text-surface-700 dark:text-surface-300">
        Tai khoan nay khong co quyen truy cap Admin Console. Vui long dang nhap bang tai
        khoan co vai tro <code className="rounded bg-surface-100 px-1 dark:bg-surface-800">ADMIN</code>.
      </p>
      <a
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
      >
        Quay lai dang nhap
      </a>
    </section>
  );
}
