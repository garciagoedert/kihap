import express from 'express';
import cors from 'cors';
import mailchimp from '@mailchimp/mailchimp_marketing';
import { config } from 'dotenv';

config(); // Load environment variables

// Initialize Mailchimp
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX
});

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Newsletter subscription endpoint
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;

  try {
    const response = await mailchimp.lists.addListMember(process.env.MAILCHIMP_LIST_ID, {
      email_address: email,
      status: 'subscribed'
    });

    res.json({
      success: true,
      message: 'Inscrição realizada com sucesso!'
    });
  } catch (error) {
    console.error('Mailchimp error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar inscrição. Por favor, tente novamente.'
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});