import { hashSync, genSaltSync } from 'bcrypt';
export const SALT = genSaltSync(10);

export enum UserRole {
  Therapist = 'Therapist',
  Client = 'Client',
}

export interface User {
  id: string;
  email: string;
  hashed_password: string;
  role: UserRole;
}

export const USERS: User[] = [
  {
    id: '1',
    email: 'simon@galaxies.dev',
    hashed_password: hashSync('password', SALT), // Your hashed password here
    role: UserRole.Therapist,
  },
];
