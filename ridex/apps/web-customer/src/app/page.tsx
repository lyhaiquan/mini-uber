import { Button, Card, CardContent, CardDescription, CardTitle } from "@ridex/ui-web";
import Link from "next/link";


export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-4 py-20 text-center">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Đi đâu cũng có{" "}
          <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
            RideX
          </span>
        </h1>
        <p className="mx-auto max-w-prose text-lg text-surface-700 dark:text-surface-300">
          Đặt xe trong vài giây. Theo dõi tài xế trên bản đồ. Trả qua ví không lo tiền lẻ.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">Đặt xe ngay</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/register">Tạo tài khoản</Link>
          </Button>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 p-6 text-left">
            <CardTitle>Đặt xe trong 30 giây</CardTitle>
            <CardDescription>Pickup gợi ý sẵn từ vị trí hiện tại, chọn đích là xong.</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-6 text-left">
            <CardTitle>Theo dõi tài xế live</CardTitle>
            <CardDescription>Vị trí cập nhật từng giây qua WebSocket.</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-6 text-left">
            <CardTitle>Ví minh bạch</CardTitle>
            <CardDescription>Lịch sử mọi giao dịch, không phí ẩn.</CardDescription>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
