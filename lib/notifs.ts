import { APP_URL } from "@/lib/constants";
import {
  sendNotificationRequest,
  sendNotificationResponseSchema,
} from "@farcaster/frame-sdk";

type SendFrameNotificationResult =
  | { state: "error"; error: unknown }
  | { state: "no_token" }
  | { state: "rate_limit" }
  | { state: "success" };

export async function sendFrameNotification({
  fid,
  title,
  body,
  image,
  url,
}: {
  fid: number;
  title: string;
  body: string;
  image: string;
  url: string;
}): Promise<SendFrameNotificationResult> {
  const res = await sendNotificationRequest({
    notification: {
      fid,
      title,
      body,
      image,
      url,
    },
    secret: process.env.FARCASTER_DEVELOPER_MNEMONIC as string,
  });

  if (res.isErr()) {
    if (res.error.message.includes("no token")) {
      return { state: "no_token" };
    }
    if (res.error.message.includes("rate limit")) {
      return { state: "rate_limit" };
    }
    return { state: "error", error: res.error };
  }

  const json = sendNotificationResponseSchema.parse(res.value);

  if (json.success) {
    return { state: "success" };
  } else {
    return { state: "error", error: json.error };
  }
}

export async function sendMatchNotification(
  fid: number,
  matchedUser: string,
  compatibility: number,
  reason: string,
  imageUrl: string
) {
  const title = `You matched with ${matchedUser}!`;
  const body = `You have a ${compatibility}% compatibility. Reason: ${reason}`;
  const url = `${APP_URL}/match/${fid}`;

  return sendFrameNotification({
    fid,
    title,
    body,
    image: imageUrl,
    url,
  });
}


