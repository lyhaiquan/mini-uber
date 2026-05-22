import { Button, Screen, Text } from "@ridex/ui-mobile";
import { Link } from "expo-router";
import { View } from "react-native";


export default function LandingScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-6">
        <Text variant="h1" className="text-center">
          Đi đâu cũng có RideX
        </Text>
        <Text variant="caption" className="text-center">
          Đặt xe trong vài giây. Theo dõi tài xế trên bản đồ. Trả qua ví.
        </Text>
        <View className="w-full gap-3">
          <Link href="/(auth)/login" asChild>
            <Button>Đặt xe ngay</Button>
          </Link>
          <Link href="/(auth)/register" asChild>
            <Button variant="outline">Tạo tài khoản</Button>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
