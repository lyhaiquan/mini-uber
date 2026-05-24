export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Khong tim thay trang</h1>
      <p className="text-surface-700 dark:text-surface-300">
        Trang ban can co the da duoc di chuyen hoac chua duoc tao.
      </p>
      <a
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
      >
        Ve trang chu
      </a>
    </section>
  );
}
