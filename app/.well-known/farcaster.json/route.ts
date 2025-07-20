import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    accountAssociation: {
      
    },
    frame: {
      version: "1",
      name: "Pacmon - Monad Pacman Game", // <--- This needs to be updated
      iconUrl: `${APP_URL}/images/splash.png`, // <--- This needs to be updated
      homeUrl: `${APP_URL}`,
      imageUrl: `${APP_URL}/images/feed.png`,
      screenshotUrls: [],
      tags: ["monad", "farcaster", "miniapp", "game", "pacman", "pacmon"], // <--- This needs to be updated
      primaryCategory: "games", // <--- This needs to be updated
      buttonTitle: "Play Pacmon", // <--- This needs to be updated
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#200052", // <--- This needs to be updated
      webhookUrl: `${APP_URL}/api/webhook`,
    },
  };

  return NextResponse.json(farcasterConfig);
}
