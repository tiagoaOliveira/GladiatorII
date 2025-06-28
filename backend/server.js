import express from 'express';
import cors from 'cors';
import { supabase } from './services/supabaseClient.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Rota de login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  res.json({ session: data.session, user: data.user });
});

// Rota de registro
app.post('/signup', async (req, res) => {
  console.log('REQBODY /signup:', req.body);
  const { data, error } = await supabase.auth.signUp({ email: req.body.email, password: req.body.password });
  if (error) {
    console.error('SIGNUP ERROR:', error.message);
    return res.status(400).json({ error: error.message });
  }
  res.json({ user: data.user });
});


const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));