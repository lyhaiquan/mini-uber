import { Button, Screen, Text } from "@ridex/ui-mobile";
import { Link } from "expo-router";


export default function NotFoundScreen() {
  return (
    <Screen>
      <Text variant="h2">Không tìm thấy</Text>
      <Text variant="body">Trang bạn cần không tồn tại.</Text>
      <Link href="/" asChild>
        <Button>Về trang chủ</Button>
      </Link>
    </Screen>
  );
}
