import { Button, Card, CardContent, CardDescription, CardTitle } from "@ridex/ui-web";
import Link from "next/link";


export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-10 px-4 py-24 text-center">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">RideX Admin Console</h1>
        <p className="text-surface-700 dark:text-surface-300">
          Đăng nhập để xem dashboard vận hành: KPI ride, driver online, GMV, danh sách tài xế và khách hàng.
        </p>
        <Button asChild size="lg">
          <Link href="/login">Đăng nhập quản trị</Link>
        </Button>
      </div>

      <Card className="w-full max-w-md text-left">
        <CardContent className="space-y-2 p-6">
          <CardTitle>Quyền truy cập</CardTitle>
          <CardDescription>
            Console chỉ mở cho tài khoản role <code className="rounded bg-surface-100 px-1 py-0.5 text-sm dark:bg-surface-800">ADMIN</code>. Truy cập trái phép sẽ bị từ chối ở backend.
          </CardDescription>
        </CardContent>
      </Card>
    </section>
  );
}
