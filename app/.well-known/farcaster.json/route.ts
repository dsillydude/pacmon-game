import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    accountAssociation: {
       "header": "eyJmaWQiOjEwNTE4NTksInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg2RjNDNzFmYzhDRGQxMTQ2OTIzMzQ2NTMyNTNhNDgxY0I5YjFlMDRmIn0",
    "payload": "eyJkb21haW4iOiJwYWNtb24tZ2FtZS52ZXJjZWwuYXBwIn0",
    "signature": "MHg4ZDllZTNiOGIzZWY4NDVmYWQzNDQ1OWY2YjlkMmUzNmQxZTY2ZmM2OWViZDlkYzk1ZDkzNzg2Mzk1ODRmNTkzNWY5NmUzYjUxMDQ1YmMyYWM4NWE2NWU2Mzg4OTRlYjQ3MTk0MzU1Mzk4NjhkNmQwOGNhYTAwMzczYTE3MTVmNjFj"
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
