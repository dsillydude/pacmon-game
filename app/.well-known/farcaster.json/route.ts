import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    accountAssociation: {
       "header": "eyJmaWQiOjEwNTE4NTksInR5cGUiOiJhdXRoIiwia2V5IjoiMHg2NkY5MzA5OEI5ODc0MGY4MjhDZTgwOTk1ZTMwZDI0RGU1YzIwZGIzIn0",
    "payload": "eyJkb21haW4iOiJwYWNtb24tZ2FtZS52ZXJjZWwuYXBwIn0",
    "signature": "fRdHxO8GXSz7dJC9BoWny0twun68RdYvTMVhqIYZjZxC43I1bgTpyhM4ib8SpHSsDXZkjLEDg5EkSVl1BVFiPRw="
    },
    frame: {
      version: "1",
      name: "Monad Farcaster MiniApp Template",
      iconUrl: `${APP_URL}/images/icon.png`,
      homeUrl: `${APP_URL}`,
      imageUrl: `${APP_URL}/images/feed.png`,
      screenshotUrls: [],
      tags: ["monad", "farcaster", "miniapp", "template"],
      primaryCategory: "developer-tools",
      buttonTitle: "Launch Template",
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#ffffff",
      webhookUrl: `${APP_URL}/api/webhook`,
    },
  };

  return NextResponse.json(farcasterConfig);
}
