import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '@prisma/client';

export interface SendNotificationDto {
  factoryId: string | null;
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

  // ────────────────────────────────────────────────────────────
  // SEND (multi-channel)
  // ────────────────────────────────────────────────────────────

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
    } catch (error) {
      this.logger.error(`Failed to send ${channel} notification`, error);
    }
  }

  async sendEmail(dto: SendNotificationDto): Promise<void> {
    if (!this.mailer) {
      this.logger.warn('SMTP not configured — email skipped');
      return;
    }

    const user = dto.userId
      ? await this.prisma.user.findUnique({ where: { id: dto.userId } })
      : null;

    if (!user?.email) return;

    await this.mailer.sendMail({
      from: this.config.get<string>('smtp.from', 'STAR-MES <noreply@star-mes.sa>'),
      to: user.email,
      subject: dto.title,
      html: this.buildEmailHtml(dto.title, dto.message, dto.metadata),
    });

    this.logger.log(`Email sent to ${user.email}: ${dto.title}`);
  }

  async sendPasswordResetEmail(email: string, resetToken: string, resetUrl: string): Promise<void> {
    if (!this.mailer) {
      this.logger.warn('SMTP not configured — password reset email skipped');
      return;
    }

    await this.mailer.sendMail({
      from: this.config.get<string>('smtp.from', 'STAR-MES <noreply@star-mes.sa>'),
      to: email,
      subject: 'Password Reset — STAR-MES',
      html: this.buildEmailHtml(
        'Password Reset Request',
        `You requested a password reset. Click the link below to set a new password. This link expires in 1 hour.`,
        { resetUrl, action: { label: 'Reset Password', url: resetUrl } },
      ),
    });
  }

  private buildEmailHtml(title: string, message: string, metadata?: Record<string, unknown>): string {
    const actionButton = metadata?.action
      ? `<a href="${(metadata.action as any).url}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#6175f4;color:white;border-radius:6px;text-decoration:none;font-weight:bold;">${(metadata.action as any).label}</a>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1f2e; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #6175f4; margin: 0; font-size: 18px;">STAR-MES</h1>
          <p style="color: #888; margin: 4px 0 0;">Manufacturing Execution System</p>
        </div>
        <div style="background: #f5f7ff; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1a1f2e; margin-top:0;">${title}</h2>
          <p style="color: #555; line-height: 1.6;">${message}</p>
          ${actionButton}
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0 20px;">
          <p style="color: #888; font-size: 12px; margin: 0;">
            This is an automated notification from STAR-MES Platform.<br>
            © ${new Date().getFullYear()} National Care Company — SIDCO
          </p>
        </div>
      </div>
    `;
  }

  // ────────────────────────────────────────────────────────────
  // IN-APP NOTIFICATIONS
  // ────────────────────────────────────────────────────────────

  async saveInAppNotification(dto: SendNotificationDto): Promise<void> {
    if (!dto.userId) return;

    await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        factoryId: dto.factoryId,
        type: dto.type as any,
        title: dto.title,
        message: dto.message,
        data: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
        isRead: false,
      },
    });
  }

  async findForUser(userId: string, factoryId: string | null, filters: {
    isRead?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const { isRead, type, page = 1, limit = 20 } = filters;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(factoryId && { OR: [{ factoryId }, { factoryId: null }] }),
      ...(isRead !== undefined && { isRead }),
      ...(type && { type: type as any }),
    };

    const [total, data, unreadCount] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const n = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!n) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, factoryId: string | null): Promise<void> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      isRead: false,
      ...(factoryId && { OR: [{ factoryId }, { factoryId: null }] }),
    };

    await this.prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const n = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!n) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id: notificationId } });
  }

  // ────────────────────────────────────────────────────────────
  // NOTIFICATION RULES ENGINE
  // ────────────────────────────────────────────────────────────

  async findNotificationRules(factoryId: string | null) {
    const factoryFilter = factoryId ? { factoryId } : {};
    return this.prisma.notificationRule.findMany({
      where: { ...factoryFilter, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createNotificationRule(factoryId: string | null, dto: {
    name: string;
    eventType: string;
    conditions?: Record<string, unknown>;
    channels: string[];
    recipientUserIds?: string[];
    recipientRoles?: string[];
    isActive?: boolean;
  }) {
    const resolvedFactoryId = factoryId ?? await this.getDefaultFactoryId();
    // Split eventType like "quality.ncr.critical" into module="quality" event="ncr.critical"
    const [module, ...eventParts] = dto.eventType.split('.');
    const event = eventParts.join('.') || dto.eventType;

    return this.prisma.notificationRule.create({
      data: {
        factoryId: resolvedFactoryId,
        name: dto.name,
        module,
        event,
        condition: (dto.conditions ?? {}) as Prisma.InputJsonValue,
        channels: dto.channels as Prisma.InputJsonValue,
        recipients: {
          userIds: dto.recipientUserIds ?? [],
          roles: dto.recipientRoles ?? [],
        } as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateNotificationRule(factoryId: string | null, ruleId: string, dto: {
    name?: string;
    conditions?: Record<string, unknown>;
    channels?: string[];
    recipientUserIds?: string[];
    recipientRoles?: string[];
    isActive?: boolean;
  }) {
    const factoryFilter = factoryId ? { factoryId } : {};
    const rule = await this.prisma.notificationRule.findFirst({
      where: { id: ruleId, ...factoryFilter },
    });
    if (!rule) throw new NotFoundException('Notification rule not found');

    const existingRecipients = (rule.recipients as any) ?? { userIds: [], roles: [] };

    return this.prisma.notificationRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.conditions && { condition: dto.conditions as Prisma.InputJsonValue }),
        ...(dto.channels && { channels: dto.channels as Prisma.InputJsonValue }),
        ...((dto.recipientUserIds || dto.recipientRoles) && {
          recipients: {
            userIds: dto.recipientUserIds ?? existingRecipients.userIds,
            roles: dto.recipientRoles ?? existingRecipients.roles,
          } as Prisma.InputJsonValue,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteNotificationRule(factoryId: string | null, ruleId: string): Promise<void> {
    const factoryFilter = factoryId ? { factoryId } : {};
    const rule = await this.prisma.notificationRule.findFirst({
      where: { id: ruleId, ...factoryFilter },
    });
    if (!rule) throw new NotFoundException('Notification rule not found');
    await this.prisma.notificationRule.delete({ where: { id: ruleId } });
  }

  // Called by event handlers to check matching rules and fan out notifications
  async evaluateRules(factoryId: string | null, eventType: string, eventData: Record<string, unknown>): Promise<void> {
    const factoryFilter = factoryId ? { factoryId } : {};
    const [module, ...eventParts] = eventType.split('.');
    const event = eventParts.join('.') || eventType;

    const rules = await this.prisma.notificationRule.findMany({
      where: { ...factoryFilter, module, event, isActive: true },
    });

    for (const rule of rules) {
      try {
        const channels = (rule.channels as string[]) ?? ['in_app'];
        const recipients = (rule.recipients as any) ?? { userIds: [], roles: [] };
        const recipientUserIds: string[] = recipients.userIds ?? [];
        const recipientRoles: string[] = recipients.roles ?? [];

        let userIds = [...recipientUserIds];
        if (recipientRoles.length > 0) {
          const roleUsers = await this.prisma.user.findMany({
            where: {
              ...(factoryId ? { factoryId } : {}),
              role: { in: recipientRoles as any[] },
              isActive: true,
            },
            select: { id: true },
          });
          userIds = [...new Set([...userIds, ...roleUsers.map((u) => u.id)])];
        }

        for (const userId of userIds) {
          await this.saveInAppNotification({
            factoryId,
            userId,
            type: eventType.split('.')[0].toUpperCase() as any,
            title: rule.name,
            message: this.interpolate(rule.name, eventData),
            channels: channels as any[],
            metadata: eventData,
          });
        }
      } catch (err) {
        this.logger.error(`Failed to evaluate rule ${rule.id}`, err);
      }
    }
  }

  private interpolate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''));
  }

  private async getDefaultFactoryId(): Promise<string> {
    const factory = await this.prisma.factory.findFirst({ where: { isActive: true } });
    if (!factory) throw new NotFoundException('No factory found');
    return factory.id;
  }
}
