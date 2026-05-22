import { Button, Card, CardContent, CardDescription, CardTitle } from "@ridex/ui-web";
import Link from "next/link";


export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-4 py-20 text-center">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Trở thành{" "}
          <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
            tài xế RideX
          </span>
        </h1>
        <p className="mx-auto max-w-prose text-lg text-surface-700 dark:text-surface-300">
          Chủ động giờ giấc. Theo dõi thu nhập realtime. Hệ thống offer minh bạch.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">Đăng nhập tài xế</Link>
          </Button>
          <p className="text-sm text-surface-700 dark:text-surface-300">
            Tài khoản tài xế được vận hành cấp — vui lòng{" "}
            <a className="text-primary-500 underline" href="mailto:ops@ridex.local">
              liên hệ hotline
            </a>{" "}
            để đăng ký.
          </p>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 p-6 text-left">
            <CardTitle>Online / Offline tức thì</CardTitle>
            <CardDescription>Toggle 1 chạm, GPS bắt đầu streaming an toàn.</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-6 text-left">
            <CardTitle>Offer countdown rõ ràng</CardTitle>
            <CardDescription>Accept / reject trong vòng vài giây, không bỏ lỡ chuyến.</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-6 text-left">
            <CardTitle>Earnings minh bạch</CardTitle>
            <CardDescription>Lịch sử chuyến + chiết khấu hiển thị rõ từng đồng.</CardDescription>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
