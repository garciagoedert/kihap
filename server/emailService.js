import nodemailer from 'nodemailer';
import { config } from 'dotenv';

config();

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Accept self-signed certificates
  }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP Configuration Error:', error);
  } else {
    console.log('SMTP Server is ready to send emails');
  }
});

export const sendWelcomeEmail = async (studentData) => {
  const { name, email } = studentData;

  if (!email) {
    console.error('No email provided for welcome email');
    return false;
  }

  const mailOptions = {
    from: `"KIHAP Martial Arts" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Bem-vindo à KIHAP Martial Arts! 🥋',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="https://kihap.com.br/wp-content/uploads/2021/02/logo-wh.png" alt="KIHAP Logo" style="max-width: 200px; margin: 20px 0;">
        
        <h1 style="color: #1d528d;">Bem-vindo à KIHAP, ${name}!</h1>
        
        <p>É com grande satisfação que damos as boas-vindas a você em nossa academia. Estamos muito felizes em tê-lo como parte da família KIHAP!</p>

        <h2 style="color: #dfa129;">Próximos Passos</h2>
        
        <ul>
          <li>Acesse sua área do aluno com seu email e a senha inicial: kihap</li>
          <li>Altere sua senha no primeiro acesso</li>
          <li>Confira seus horários de treino</li>
          <li>Fique atento às notificações importantes</li>
        </ul>

        <p>Se tiver alguma dúvida, não hesite em entrar em contato conosco.</p>

        <div style="margin: 30px 0; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
          <h3 style="color: #1d528d; margin-top: 0;">Nosso Propósito</h3>
          <p style="margin-bottom: 0;">Nosso propósito é que as pessoas (re)conheçam o poder da energia interior e que, com disciplina positiva, entre em harmonia com o objetivo definido e evolua a sua própria realidade.</p>
        </div>

        <p style="color: #666;">Atenciosamente,<br>Equipe KIHAP</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
          <p>Este é um email automático, por favor não responda.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};