import nodemailer from "nodemailer";

// Sends to Mailpit locally (inbox at http://localhost:8025). Nothing leaves the machine.
export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
});

export const MAIL_FROM = process.env.MAIL_FROM ?? "Clinic <no-reply@clinic.test>";
