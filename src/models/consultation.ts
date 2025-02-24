export enum ConsultationStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled',
  Completed = 'Completed',
}

export interface Consultation {
  id: string;
  clientId: string;
  therapistId: string;
  dateTime: string;
  status: ConsultationStatus;
  notes?: string;
}

export const CONSULTATIONS: Consultation[] = [];
