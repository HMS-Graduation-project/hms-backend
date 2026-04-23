import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a notification for a user.
   * Returns the created notification entity.
   */
  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data ?? null,
      },
    });
  }

  /**
   * Find all notifications for a user (paginated).
   * Supports filtering by type and read status.
   */
  async findAll(userId: string, query: NotificationQueryDto) {
    const where: Record<string, unknown> = { userId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    return paginate(
      this.prisma.notification as any,
      { where },
      query,
    );
  }

  /**
   * Count unread notifications for a user.
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  /**
   * Mark a single notification as read.
   * Verifies that the notification belongs to the requesting user.
   */
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with id "${id}" not found`);
    }

    if (notification.userId !== userId) {
      throw new NotFoundException(`Notification with id "${id}" not found`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user.
   * Returns the count of updated records.
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { updated: result.count };
  }
}
