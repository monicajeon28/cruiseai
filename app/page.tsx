// 루트는 채팅으로 리다이렉트
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/chat");
}
