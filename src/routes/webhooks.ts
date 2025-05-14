// src/routes/webhooks.ts
import { Request, Response, Router } from "express";
import CallLog, { CallStatus, ICallLog } from "../models/callLog.model";
import User, { IUser } from "../models/user.model";
import { StreamClient } from "@stream-io/node-sdk";
import crypto from "crypto";

const router = Router();

const streamApiKey = process.env.STREAM_API_KEY;
const streamApiSecret = process.env.STREAM_API_SECRET;

if (!streamApiKey || !streamApiSecret) {
  console.error(
    "FATAL ERROR: STREAM_API_KEY or STREAM_API_SECRET is not defined for webhooks!"
  );
}

const streamClient =
  streamApiKey && streamApiSecret
    ? new StreamClient(streamApiKey, streamApiSecret)
    : null;

if (!streamClient) {
  console.error(
    "[Webhook] StreamClient could not be initialized. Webhooks will likely fail to interact with Stream API."
  );
}

async function findUserByStreamId(streamId: string): Promise<IUser | null> {
  if (!streamId) {
    console.warn("[Webhook_findUserByStreamId] streamId is null or undefined.");
    return null;
  }
  try {
    const user = await User.findOne({ streamId: streamId });
    return user;
  } catch (error) {
    console.error(
      `[Webhook_findUserByStreamId] Error finding user with streamId ${streamId}:`,
      error
    );
    return null;
  }
}

interface EventMember {
  user_id: string;
  role?: string;
}

async function getClientAndTherapistFromMembers(
  members: EventMember[]
): Promise<{ clientUser: IUser | null; therapistUser: IUser | null }> {
  let clientUser: IUser | null = null;
  let therapistUser: IUser | null = null;
  for (const member of members) {
    if (!member.user_id) continue;
    const userDoc = await findUserByStreamId(member.user_id);
    if (userDoc) {
      if (userDoc.role === "client" && !clientUser) clientUser = userDoc;
      else if (userDoc.role === "therapist" && !therapistUser)
        therapistUser = userDoc;
    }
    if (clientUser && therapistUser) break;
  }
  return { clientUser, therapistUser };
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const rawBody = req.body; // Buffer from express.raw()

  // --- Webhook Signature Verification ---
  if (process.env.NODE_ENV === "production") {
    // Enforce in production
    if (streamApiSecret && rawBody) {
      const signatureHeader =
        (req.headers["x-signature"] as string) ||
        (req.headers["x-stream-signature"] as string);
      if (!signatureHeader) {
        console.warn("[Webhook] Missing signature header");
        res.status(401).send("Missing signature");
        return;
      }
      const hmac = crypto.createHmac("sha256", streamApiSecret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest("hex");

      if (
        !crypto.timingSafeEqual(
          Buffer.from(signatureHeader),
          Buffer.from(expectedSignature)
        )
      ) {
        console.warn(
          `[Webhook] Invalid signature. Got: ${signatureHeader}, Expected: ${expectedSignature}`
        );
        res.status(401).send("Invalid signature");
        return;
      }
      console.log("[Webhook] Signature verified.");
    } else {
      console.error(
        "[Webhook] CRITICAL: Signature verification failed (no secret or rawBody). Rejecting request."
      );
      res
        .status(500)
        .send("Webhook configuration error for signature verification.");
      return;
    }
  } else {
    console.warn(
      "[Webhook] Signature verification skipped (NODE_ENV is not production). THIS IS INSECURE."
    );
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch (parseError) {
    console.error("[Webhook] Error parsing event JSON:", parseError);
    res.status(400).send("Invalid JSON in request body");
    return;
  }

  console.log(`[Webhook] Received Stream Event Type: ${event?.type}`);
  if (Object.keys(event).length < 20) {
    console.log(`[Webhook] Event Payload: ${JSON.stringify(event, null, 2)}`);
  } else {
    console.log(
      `[Webhook] Event Payload (cid: ${event?.call_cid}, session: ${
        event?.session_id
      }, user: ${event?.participant?.user_id || event?.user?.id})`
    );
  }

  try {
    const callCID: string | undefined = event?.call_cid;
    let callTypeFromEvent: string | undefined = event?.call?.type;
    let callIdFromEvent: string | undefined = event?.call?.id;

    // --- MODIFICATION START ---
    // If event.call is not present (like in session_participant_left/joined),
    // parse type and id from callCID
    if (callCID && (!callTypeFromEvent || !callIdFromEvent)) {
      const parts = callCID.split(":");
      if (parts.length === 2) {
        callTypeFromEvent = parts[0];
        callIdFromEvent = parts[1];
        console.log(
          `[Webhook] Parsed from callCID: type='${callTypeFromEvent}', id='${callIdFromEvent}' for event type ${event?.type}`
        );
      } else {
        console.warn(
          `[Webhook] Could not parse type and id from callCID '${callCID}' for event type ${event?.type}`
        );
      }
    }
    // --- MODIFICATION END ---

    if (!callCID || !callTypeFromEvent || !callIdFromEvent) {
      console.warn(
        `[Webhook] Event '${event?.type}' still missing call_cid, callType, or callId after parsing. Skipping. Event:`,
        event
      );
      res
        .status(200)
        .send("Event received but missing crucial call identifiers.");
      return;
    }

    let callLog: ICallLog | null = await CallLog.findOne({ callId: callCID });

    switch (event.type) {
      case "call.created":
      case "call.ring":
        console.log(`[Webhook] Handling ${event.type} for call ${callCID}`);
        if (!callLog) {
          const members: EventMember[] =
            event?.members || event?.call?.members || [];
          const customData = event?.call?.custom;
          let clientUser: IUser | null = null;
          let therapistUser: IUser | null = null;

          if (customData?.caller_id && customData?.therapist_stream_id) {
            const caller = await findUserByStreamId(customData.caller_id);
            const receiver = await findUserByStreamId(
              customData.therapist_stream_id
            );
            if (caller?.role === "client") clientUser = caller;
            if (receiver?.role === "therapist") therapistUser = receiver;
            if (caller?.role === "therapist") therapistUser = caller;
            if (receiver?.role === "client") clientUser = receiver;
          } else if (members.length > 0) {
            const users = await getClientAndTherapistFromMembers(members);
            clientUser = users.clientUser;
            therapistUser = users.therapistUser;
          }

          if (clientUser && therapistUser) {
            callLog = new CallLog({
              callId: callCID,
              clientId: clientUser._id,
              therapistId: therapistUser._id,
              status: CallStatus.Initiated,
            });
            await callLog.save();
            console.log(
              `[Webhook] CallLog CREATED for ${callCID} with status ${callLog.status}`
            );
          } else {
            console.warn(
              `[Webhook] Could not map client/therapist for ${callCID} during ${event.type}. Members:`,
              members,
              "CustomData:",
              customData
            );
          }
        } else {
          console.log(
            `[Webhook] CallLog for ${callCID} already exists while handling ${event.type}. Status: ${callLog.status}`
          );
        }
        break;

      case "call.session_started":
        console.log(`[Webhook] Handling ${event.type} for call ${callCID}`);
        if (callLog) {
          if (callLog.status === CallStatus.Initiated) {
            callLog.status = CallStatus.Active;
            callLog.startTime = new Date(
              event.call?.session?.started_at || event.created_at
            );
            await callLog.save();
            console.log(
              `[Webhook] CallLog for ${callCID} UPDATED to Active, startTime set to ${callLog.startTime}`
            );
          } else {
            console.log(
              `[Webhook] CallLog for ${callCID} status is ${callLog.status}, not updating for session_started.`
            );
          }
        } else {
          console.warn(
            `[Webhook] Received ${event.type} for ${callCID}, but no CallLog found. Cannot update.`
          );
        }
        break;

      case "call.session_participant_joined":
        console.log(
          `[Webhook] Participant joined call ${callCID}, User: ${event.participant?.user?.id}`
        );
        // No specific action here for now, but it's logged.
        // The `callTypeFromEvent` and `callIdFromEvent` should now be correctly populated.
        break;

      case "call.session_participant_left":
        console.log(
          `[Webhook] Participant left call ${callCID}. User: ${event.participant?.user?.id}.`
        );
        // The event.call object *is* present in the logs for this event if a call is active,
        // so the initial parsing of callTypeFromEvent and callIdFromEvent should work.
        // However, the added parsing logic ensures it works even if event.call was missing.
        const currentCallStateInEvent = event.call; // Get the call object if present in THIS event
        const participantsInSessionCount =
          currentCallStateInEvent?.session?.participants_count ??
          event.call?.session?.participants_count ??
          0;
        console.log(
          `[Webhook] Remaining participants in session according to event.call: ${participantsInSessionCount}`
        );

        if (callLog) {
          if (callLog.status === CallStatus.Active) {
            const isConsideredOneOnOneCall =
              callLog.clientId && callLog.therapistId;

            // Use participants_count from the event if available, this is more reliable for "current state"
            if (isConsideredOneOnOneCall && participantsInSessionCount <= 1) {
              console.log(
                `[Webhook] 1-on-1 call ${callCID} ending as a participant left. Remaining: ${participantsInSessionCount}.`
              );
              callLog.endTime = new Date(event.created_at);
              callLog.status = CallStatus.Completed;
              if (callLog.startTime && callLog.endTime) {
                const durationMillis =
                  callLog.endTime.getTime() - callLog.startTime.getTime();
                callLog.durationMinutes = Math.max(
                  0,
                  Math.ceil(durationMillis / (1000 * 60))
                );
              } else {
                callLog.durationMinutes = 0;
              }
              await callLog.save();
              console.log(
                `[Webhook] CallLog for ${callCID} updated to ${callLog.status} with duration ${callLog.durationMinutes}m.`
              );

              if (streamClient) {
                try {
                  console.log(
                    `[Webhook] Deleting Stream call ${callTypeFromEvent}:${callIdFromEvent} to end it.`
                  );
                  const callToDelete = streamClient.video.call(
                    callTypeFromEvent,
                    callIdFromEvent
                  );
                  await callToDelete.delete(); // This effectively ends the call for all
                  console.log(
                    `[Webhook] Stream call ${callTypeFromEvent}:${callIdFromEvent} deleted.`
                  );
                } catch (e: any) {
                  console.error(
                    `[Webhook] Error deleting Stream call ${callTypeFromEvent}:${callIdFromEvent}:`,
                    e.message || e
                  );
                }
              } else {
                console.warn(
                  "[Webhook] streamClient not initialized. Cannot delete Stream call."
                );
              }
            } else {
              console.log(
                `[Webhook] Participant left call ${callCID}, but call continues. Remaining: ${participantsInSessionCount}.`
              );
            }
          } else {
            console.log(
              `[Webhook] Participant left call ${callCID}, but CallLog status is ${callLog.status}. No action taken to end call.`
            );
          }
        } else {
          console.warn(
            `[Webhook] Received participant_left for ${callCID}, but no CallLog found.`
          );
        }
        break;

      case "call.ended": // This event is triggered after a call is "deleted" or ends naturally
        console.log(
          `[Webhook] Call ended event for ${callCID}. Ended at: ${event.call?.ended_at}`
        );
        if (callLog) {
          if (
            callLog.status !== CallStatus.Completed &&
            callLog.status !== CallStatus.Failed
          ) {
            callLog.endTime = new Date(
              event.call?.ended_at || event.created_at
            );
            callLog.status = CallStatus.Completed;
            if (callLog.startTime && callLog.endTime) {
              const durationMillis =
                callLog.endTime.getTime() - callLog.startTime.getTime();
              callLog.durationMinutes = Math.max(
                0,
                Math.ceil(durationMillis / (1000 * 60))
              );
            } else {
              callLog.durationMinutes = 0;
            }
            await callLog.save();
            console.log(
              `[Webhook] CallLog for ${callCID} finalized by call.ended event. Duration: ${callLog.durationMinutes}m.`
            );
          } else {
            console.log(
              `[Webhook] CallLog for ${callCID} was already finalized (Status: ${callLog.status}). Ignoring redundant call.ended.`
            );
          }
        } else {
          console.warn(
            `[Webhook] Received call.ended for ${callCID}, but no CallLog found.`
          );
        }
        break;

      case "call.rejected":
      case "call.missed":
        console.log(`[Webhook] Call ${event.type} event for ${callCID}.`);
        if (callLog) {
          if (
            callLog.status !== CallStatus.Completed &&
            callLog.status !== CallStatus.Failed
          ) {
            callLog.status = CallStatus.Failed;
            callLog.endTime = new Date(event.created_at);
            callLog.durationMinutes = 0;
            await callLog.save();
            console.log(
              `[Webhook] CallLog for ${callCID} set to Failed due to ${event.type}.`
            );
          } else {
            console.log(
              `[Webhook] CallLog for ${callCID} already finalized. Ignoring ${event.type}.`
            );
          }
        } else {
          console.warn(
            `[Webhook] Received ${event.type} for ${callCID}, but no CallLog found.`
          );
        }
        break;

      // It seems call.accepted is also triggering the "missing call.type/id" issue if event.call is not there.
      // Let's add a generic handler for it or just log it if it's not essential for business logic.
      case "call.accepted":
        console.log(
          `[Webhook] Call accepted event for ${callCID} by user ${
            event.user?.id
          }. Call object in event: ${!!event.call}`
        );
        // If event.call is present, it will be handled. If not, callType and callId are parsed from CID.
        // No specific action for CallLog here, session_started is more important for status.
        break;

      default:
        console.log(
          `[Webhook] Ignoring event type: ${event.type} for call ${callCID}`
        );
    }

    res.status(200).send("Webhook received and processed.");
  } catch (error: any) {
    console.error(
      "[Webhook] Top-level error processing Stream event:",
      error.message,
      error.stack
    );
    res.status(500).send("Error processing webhook");
  }
});

export default router;
