import { Request, Response, Router } from 'express';
import { USERS, UserRole } from '../models/user';
import { CONSULTATIONS, ConsultationStatus } from '../models/consultation';
import { authenticateToken } from '../middleware/auth';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

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

  const consultationsWithClientInfo = userConsultations.map((consultation) => {
    const client = USERS.find((user) => user.id === consultation.clientId);
    return {
      ...consultation,
      clientEmail: client?.email,
    };
  });

  return res.json(consultationsWithClientInfo);
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
