import { requireChatGPTUser } from "./chatgpt-auth";
import GymApp from "./gym-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <GymApp userId={user.userId} />;
}
