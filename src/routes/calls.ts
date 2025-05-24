// src/routes/calls.ts
import { Request, Response, Router } from "express";
import { authenticateToken } from "../middleware/auth";
import CallLog, { ICallLog, CallStatus } from "../models/callLog.model";
import User, { IUser, UserRole } from "../models/user.model";
import { Types } from "mongoose";

const router = Router();

// Interface for call notifications
interface CallNotification {
  id: string;
  callId: string;
  callMode: "audio" | "video";
  callerName: string;
  callerStreamId: string;
  therapistStreamId: string;
  callRate: number;
  createdAt: Date;
}

// In-memory store for active call notifications (in production, use Redis or database)
const activeNotifications = new Map<string, CallNotification>();

// Send notification to therapist about incoming call
router.post(
  "/notify-therapist",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUser;
    const { therapistId, callId, callMode, callerName, callRate } = req.body;

    try {
      // Verify the therapist exists and is available
      const therapist = await User.findById(therapistId);
      if (!therapist || therapist.role !== UserRole.Therapist) {
        res.status(404).json({ message: "Therapist not found" });
        return;
      }

      if (!therapist.isAvailable) {
        res.status(400).json({ message: "Therapist is not available" });
        return;
      }

      // Create notification
      const notification: CallNotification = {
        id: `${callId}_${Date.now()}`,
        callId,
        callMode,
        callerName,
        callerStreamId: user.streamId,
        therapistStreamId: therapist.streamId,
        callRate,
        createdAt: new Date(),
      };

      // Store notification for the therapist
      activeNotifications.set(therapist.streamId, notification);

      console.log(
        `[NotifyTherapist] Created notification for therapist ${therapist.email} about call ${callId}`
      );

      // Auto-cleanup notification after 30 seconds if not handled
      setTimeout(() => {
        if (activeNotifications.has(therapist.streamId)) {
          activeNotifications.delete(therapist.streamId);
          console.log(
            `[NotifyTherapist] Auto-cleaned up notification for ${therapist.email}`
          );
        }
      }, 30000);

      res.status(200).json({ message: "Notification sent successfully" });
    } catch (error: any) {
      console.error("Error sending notification:", error);
      res.status(500).json({ message: "Failed to send notification" });
    }
  }
);

// Get pending notifications for the authenticated therapist
router.get(
  "/pending-notifications",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUser;

    try {
      if (user.role !== UserRole.Therapist) {
        res
          .status(403)
          .json({ message: "Only therapists can check for notifications" });
        return;
      }

      const notification = activeNotifications.get(user.streamId);
      const notifications = notification ? [notification] : [];

      res.status(200).json(notifications);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  }
);

// Clear notification after therapist responds
router.delete(
  "/clear-notification/:notificationId",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUser;
    const { notificationId } = req.params;

    try {
      if (user.role !== UserRole.Therapist) {
        res
          .status(403)
          .json({ message: "Only therapists can clear notifications" });
        return;
      }

      // Find and remove the notification
      const notification = activeNotifications.get(user.streamId);
      if (notification && notification.id === notificationId) {
        activeNotifications.delete(user.streamId);
        console.log(
          `[ClearNotification] Cleared notification ${notificationId} for therapist ${user.email}`
        );
      }

      res.status(200).json({ message: "Notification cleared" });
    } catch (error: any) {
      console.error("Error clearing notification:", error);
      res.status(500).json({ message: "Failed to clear notification" });
    }
  }
);
// Interface for the plain JavaScript object after .lean() and population
interface PopulatedCallLogLean {
  _id: Types.ObjectId | string; // Accommodate if it's already a string or allow conversion
  callId: string;
  clientId: Pick<IUser, "_id" | "name" | "email" | "role"> | null; // Populated, can be null if original ID was null
  therapistId: Pick<IUser, "_id" | "name" | "email" | "role"> | null; // Populated, can be null
  startTime?: Date;
  endTime?: Date;
  durationMinutes?: number;
  coinsPerMinuteRate?: number;
  clientDebitedCoins?: number;
  therapistCreditedCoins?: number;
  status: CallStatus | string;
  createdAt: Date;
  updatedAt: Date;
  callType?: "audio" | "video" | "Unknown";
}

router.get(
  "/history",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUser;

    try {
      let queryCondition = {};
      if (user.role === UserRole.Client) {
        queryCondition = { clientId: user._id };
      } else if (user.role === UserRole.Therapist) {
        queryCondition = { therapistId: user._id };
      } else {
        res
          .status(403)
          .json({ message: "User role not supported for call history." });
        return;
      }

      const callLogsFromDb = await CallLog.find(queryCondition)
        .populate<{ clientId: PopulatedCallLogLean["clientId"] }>(
          "clientId",
          "name email role _id"
        )
        .populate<{ therapistId: PopulatedCallLogLean["therapistId"] }>(
          "therapistId",
          "name email role _id"
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(); // .lean() returns plain JS objects

      // More robust type assertion using 'unknown' first if direct cast fails
      // This tells TypeScript to discard previous type info and then apply the new one.
      const callLogs = callLogsFromDb as unknown as PopulatedCallLogLean[];

      const formattedHistory = callLogs.map((log) => {
        let otherPartyName = "Unknown User";
        let otherPartyRole: UserRole | string = "Unknown";

        // Handle potentially null populated fields (if original ID was null or population failed silently)
        if (user.role === UserRole.Client && log.therapistId) {
          otherPartyName = log.therapistId.name || log.therapistId.email;
          otherPartyRole = log.therapistId.role;
        } else if (user.role === UserRole.Therapist && log.clientId) {
          otherPartyName = log.clientId.name || log.clientId.email;
          otherPartyRole = log.clientId.role;
        }

        const callTypeFromLog = log.callType || "Video";

        return {
          // Ensure log._id is handled correctly before toString()
          id: typeof log._id === "string" ? log._id : log._id.toString(),
          callIdStream: log.callId,
          otherPartyName,
          otherPartyRole,
          startTime: log.startTime,
          endTime: log.endTime,
          durationMinutes: log.durationMinutes,
          status: log.status as string,
          coinsDebited:
            user.role === UserRole.Client ? log.clientDebitedCoins : undefined,
          coinsEarned:
            user.role === UserRole.Therapist
              ? log.therapistCreditedCoins
              : undefined,
          createdAt: log.createdAt,
          callType: callTypeFromLog,
        };
      });

      res.status(200).json(formattedHistory);
    } catch (error: any) {
      console.error("Error fetching call history:", error);
      res.status(500).json({
        message: "Server error fetching call history.",
        details: error.message,
      });
    }
  }
);

export default router;
