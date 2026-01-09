import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Core email sending function
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ 
  to, 
  subject, 
  html, 
  from = 'StudentVoice <onboarding@resend.dev>' 
}: EmailOptions): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error };
    }

    console.log('✅ Email sent successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Unexpected error in sendEmail:', error);
    return { success: false, error };
  }
}

// Specific email templates
interface SendVerificationEmailParams {
  email: string;
  name: string;
  verificationToken: string;
}

export async function sendVerificationEmail({ 
  email, 
  name, 
  verificationToken 
}: SendVerificationEmailParams): Promise<{ success: boolean; error?: any }> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        /* Your improved styles from version 1 */
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
        .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9fafb; }
        .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; padding: 20px; }
        .code-box { background: white; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb; margin: 15px 0; font-family: monospace; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to StudentVoice!</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Thank you for signing up! Please verify your email address to complete your registration.</p>
          
          <div style="text-align: center;">
            <a href="${verificationLink}" class="button">Verify Email Address</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <div class="code-box">
            ${verificationLink}
          </div>
          
          <p><strong>⚠️ This link will expire in 24 hours.</strong></p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>StudentVoice - Campus Complaint Management System</p>
          <p>© ${new Date().getFullYear()} StudentVoice. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  console.log(`📧 Sending verification email to ${email}`);
  
  const result = await sendEmail({
    to: email,
    subject: 'Verify your StudentVoice account',
    html,
  });

  return { success: result.success, error: result.error };
}

export async function sendWelcomeEmail(email: string, name: string): Promise<{ success: boolean; error?: any }> {
  const html = `
    <div class="container">
      <div class="header">
        <h1>🎉 Welcome to StudentVoice, ${name}!</h1>
      </div>
      <div class="content">
        <p>Your account has been successfully verified and you're now ready to:</p>
        <ul>
          <li>✅ Submit complaints and issues</li>
          <li>📊 Track complaint status</li>
          <li>🔔 Get updates on resolutions</li>
          <li>🏫 Connect with college administration</li>
        </ul>
        <p>Thank you for joining our platform to make your college experience better!</p>
        <p>Best regards,<br>The StudentVoice Team</p>
      </div>
    </div>
  `;

  console.log(`📧 Sending welcome email to ${email}`);
  
  return await sendEmail({
    to: email,
    subject: 'Welcome to StudentVoice!',
    html,
  });
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<{ success: boolean; error?: any }> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
  
  const html = `
    <div class="container">
      <div class="header">
        <h1>Reset Your Password</h1>
      </div>
      <div class="content">
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <div style="text-align: center;">
          <a href="${resetLink}" class="button">Reset Password</a>
        </div>
        <p>Or use this link:</p>
        <div class="code-box">${resetLink}</div>
        <p><strong>This link expires in 1 hour.</strong></p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject: 'Reset Your StudentVoice Password',
    html,
  });
}

// Utility function for testing
export async function testEmailService(to: string = 'test@example.com'): Promise<{ success: boolean; error?: any }> {
  console.log('🧪 Testing email service...');
  
  const result = await sendEmail({
    to,
    subject: 'Test Email from StudentVoice',
    html: '<h1>Test Email</h1><p>If you receive this, email service is working correctly!</p>'
  });

  if (result.success) {
    console.log('✅ Email service test PASSED');
  } else {
    console.log('❌ Email service test FAILED');
  }
  
  return result;
}