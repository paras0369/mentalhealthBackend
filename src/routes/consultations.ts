import { Request, Response, Router } from 'express';
import { StreamChat } from 'stream-chat';
import { USERS, UserRole } from '../models/user';
import { CONSULTATIONS, ConsultationStatus } from '../models/consultation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const { STREAM_API_KEY, STREAM_API_SECRET } = process.env;
const client = StreamChat.getInstance(STREAM_API_KEY!, STREAM_API_SECRET);

// Create consultation
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  const { therapistId, dateTime, notes } = req.body;
  const user = req.user!;

  if (user.role !== UserRole.Client) {
    return res.status(403).json({ message: 'Only clients can schedule consultations' });
  }

  const therapist = USERS.find((u) => u.id === therapistId && u.role === UserRole.Therapist);
  if (!therapist) {
    return res.status(404).json({ message: 'Therapist not found' });
  }

  const consultation = {
    id: Math.random().toString(36).substr(2, 9),
    clientId: user.id,
    therapistId,
    dateTime,
    status: ConsultationStatus.Pending,
    notes,
  };

  CONSULTATIONS.push(consultation);
  return res.json(consultation);
});

// Get consultations
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  const user = req.user!;

  const userConsultations = CONSULTATIONS.filter((consultation) =>
    user.role === UserRole.Client
      ? consultation.clientId === user.id
      : consultation.therapistId === user.id
  );

  return res.json(userConsultations);
});

// Update consultation status
router.patch('/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { status } = req.body;
  const user = req.user!;

  const consultation = CONSULTATIONS.find((c) => c.id === id);
  if (!consultation) {
    return res.status(404).json({ message: 'Consultation not found' });
  }

  if (user.role !== UserRole.Therapist || consultation.therapistId !== user.id) {
    return res
      .status(403)
      .json({ message: 'Only the assigned therapist can update consultation status' });
  }

  if (!Object.values(ConsultationStatus).includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  consultation.status = status;
  return res.json(consultation);
});

export default router;
