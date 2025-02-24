import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import consultationRoutes from './routes/consultations';

dotenv.config();

const app = express();
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/consultations', consultationRoutes);

const { PORT } = process.env;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
