import React from "react";
import { Pressable, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { authClient } from "@/lib/authClient";
import { useSession } from "@/lib/useSession";
import { cn } from "@/utils/cn";

const LoginButton = () => {
  const navigation = useNavigation();
  const { data: session, isPending } = useSession();

  return (
    <Pressable
      disabled={isPending}
      onPress={() => {
        if (session) {
          authClient.signOut();
        } else {
          navigation.navigate("LoginModalScreen");
        }
      }}
      className={cn("p-4 rounded-md", session ? "bg-red-500" : "bg-blue-500")}
    >
      <Text className="text-white">{session ? "Logout" : "Login"}</Text>
    </Pressable>
  );
};

export default LoginButton;
