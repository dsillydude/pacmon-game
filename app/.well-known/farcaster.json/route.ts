import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    // TODO: Add account association
    frame: {
      version: "1",
      name: "Pacmon - Monad Pacman Game",
      iconUrl: `${APP_URL}/images/splash.png`,
      homeUrl: `${APP_URL}`,
      imageUrl: `${APP_URL}/images/feed.png`,
      screenshotUrls: [],
      tags: ["monad", "farcaster", "miniapp", "game", "pacman", "pacmon"],
      primaryCategory: "games",
      buttonTitle: "Play Pacmon",
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#200052",
      webhookUrl: `${APP_URL}/api/webhook`,
    },
  };

  return NextResponse.json(farcasterConfig);
}
