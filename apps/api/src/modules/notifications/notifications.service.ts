import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';

export interface SendNotificationDto {
  tenantId: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  channels: Array<'email' | 'sms' | 'push' | 'in_app'>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private mailer?: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.setupMailer();
  }

  private setupMailer() {
    const smtpHost = this.config.get<string>('smtp.host');
    if (!smtpHost) return;

    this.mailer = nodemailer.createTransport({
      host: smtpHost,
      port: this.config.get<number>('smtp.port', 587),
      secure: this.config.get<boolean>('smtp.secure', false),
      auth: {
        user: this.config.get<string>('smtp.user'),
        pass: this.config.get<string>('smtp.password'),
      },
    });
  }

  async send(dto: SendNotificationDto): Promise<void> {
    await Promise.allSettled(
      dto.channels.map((channel) => this.sendByChannel(dto, channel)),
    );
  }

  private async sendByChannel(dto: SendNotificationDto, channel: string): Promise<void> {
    try {
      switch (channel) {
        case 'email':
          await this.sendEmail(dto);
          break;
        case 'in_app':
          await this.saveInAppNotification(dto);
          break;
        default:
          this.logger.warn(`Channel ${channel} not yet implemented`);
      }

      await this.logNotification(dto, channel, 'SENT');
    } catch (error) {
      this.logger.error(`Failed to send ${channel} notification`, error);
      await this.logNotification(dto, channel, 'FAILED', String(error));
    }
  }

  private async sendEmail(dto: SendNotificationDto): Promise<void> {
    if (!this.mailer) return;

    const user = dto.userId
      ? await this.prisma.user.findUnique({ where: { id: dto.userId } })
      : null;

    if (!user?.email) return;

    await this.mailer.sendMail({
      from: this.config.get<string>('smtp.from', 'INDUSTRY360 MES <noreply@industry360.sa>'),
      to: user.email,
      subject: dto.title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1f2e; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #6175f4; margin: 0; font-size: 18px;">INDUSTRY360 MES</h1>
          </div>
          <div style="background: #f5f7ff; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1f2e;">${dto.title}</h2>
            <p style="color: #555;">${dto.message}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #888; font-size: 12px;">
              This is an automated notification from INDUSTRY360 MES Platform.
            </p>
          </div>
        </div>
      `,
    });
  }

  private async saveInAppNotification(dto: SendNotificationDto): Promise<void> {
    await this.prisma.notificationLog.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        channel: 'in_app',
        status: 'SENT',
        sentAt: new Date(),
        metadata: dto.metadata as object | undefined,
      },
    });
  }

  private async logNotification(
    dto: SendNotificationDto,
    channel: string,
    status: string,
    error?: string,
  ): Promise<void> {
    await this.prisma.notificationLog.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        channel,
        status,
        sentAt: status === 'SENT' ? new Date() : undefined,
        error,
      },
    });
  }
}
