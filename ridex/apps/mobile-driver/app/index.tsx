import { Button, Screen, Text } from "@ridex/ui-mobile";
import { Link } from "expo-router";
import { Linking, View } from "react-native";

export default function LandingScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-6">
        <Text variant="h1" className="text-center">
          Trở thành tài xế RideX
        </Text>
        <Text variant="caption" className="text-center">
          Chủ động giờ giấc. Earnings minh bạch. Offer countdown rõ ràng.
        </Text>
        <View className="w-full gap-3">
          <Link href="/(auth)/login" asChild>
            <Button>Đăng nhập tài xế</Button>
          </Link>
          <Button variant="outline" onPress={() => Linking.openURL("mailto:ops@ridex.local")}>
            Liên hệ vận hành để đăng ký
          </Button>
        </View>
      </View>
    </Screen>
  );
}
