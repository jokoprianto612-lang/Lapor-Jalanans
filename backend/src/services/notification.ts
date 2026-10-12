// Notification Service - Multi-channel notifications (WhatsApp, Email, SMS, Push)
// Sends notifications to users and authorities

import type { NotificationPayload, NotificationType, WhatsAppMessage } from '../types/index.js';

import { prisma } from '../lib/db.js';

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const NOTIFICATION_CONFIG = {
  whatsapp: {
    enabled: !!process.env.WHATSAPP_API_URL,
    apiUrl: process.env.WHATSAPP_API_URL || 'https://api.whatsapp.com/send',
    apiKey: process.env.WHATSAPP_API_KEY || '',
    templateNamespace: process.env.WHATSAPP_TEMPLATE_NS || ''
  },
  email: {
    enabled: !!process.env.SMTP_HOST,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@laporjalan.id'
  },
  sms: {
    enabled: !!process.env.SMS_API_URL,
    apiUrl: process.env.SMS_API_URL || '',
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || 'LaporJalan'
  },
  push: {
    enabled: !!process.env.FCM_SERVER_KEY,
    serverKey: process.env.FCM_SERVER_KEY || '',
    vapidKeys: {
      public: process.env.VAPID_PUBLIC_KEY || '',
      private: process.env.VAPID_PRIVATE_KEY || ''
    }
  }
};

// ─────────────────────────────────────────────
// Notification Templates
// ─────────────────────────────────────────────

const TEMPLATES = {
  // Report submitted
  REPORT_SUBMITTED: {
    whatsapp: 'Halo {name}, laporan Anda "{title}" telah diterima dengan kode tracking *{trackingCode}*. Status: *SUBMITTED*. Cek progress: {url}',
    email: {
      subject: 'Laporan Diterima - {trackingCode}',
      body: `
        Halo {name},
        
        Terima kasih telah melaporkan kerusakan jalan melalui Lapor Jalan.
        
        Detail Laporan:
        - Kode Tracking: {trackingCode}
        - Judul: {title}
        - Lokasi: {address}
        - Jenis Kerusakan: {damageType}
        - Tingkat Keparahan: {severity}
        - Status: SUBMITTED
        
        Anda bisa memantau perkembangan laporan di: {url}
        
        Tim Lapor Jalan
      `
    },
    sms: 'LaporJalan: Laporan {trackingCode} ({title}) diterima. Status: SUBMITTED. Cek: {url}',
    push: {
      title: 'Laporan Diterima',
      body: '{title} - Kode: {trackingCode}'
    }
  },
  
  // Status update
  STATUS_UPDATED: {
    whatsapp: 'Update laporan *{trackingCode}* ({title}): Status berubah dari *{oldStatus}* ke *{newStatus}*. {message}',
    email: {
      subject: 'Update Status Laporan - {trackingCode}',
      body: `
        Halo {name},
        
        Ada update pada laporan Anda:
        
        - Kode Tracking: {trackingCode}
        - Judul: {title}
        - Status Sebelumnya: {oldStatus}
        - Status Baru: {newStatus}
        - Catatan: {message}
        
        Lihat detail: {url}
        
        Tim Lapor Jalan
      `
    },
    sms: 'LaporJalan: Update {trackingCode} - {oldStatus} -> {newStatus}. {message}',
    push: {
      title: 'Update Laporan',
      body: '{trackingCode}: {oldStatus} → {newStatus}'
    }
  },
  
  // Assigned to staff
  REPORT_ASSIGNED: {
    whatsapp: 'Halo {staffName}, Anda ditugaskan handle laporan *{trackingCode}*: {title} di {address}. Jenis: {damageType}, Keparahan: {severity}. Detail: {url}',
    email: {
      subject: 'Tugas Baru: Laporan {trackingCode}',
      body: `
        Halo {staffName},
        
        Anda ditugaskan untuk menangani laporan berikut:
        
        - Kode Tracking: {trackingCode}
        - Judul: {title}
        - Lokasi: {address}
        - Jenis Kerusakan: {damageType}
        - Tingkat Keparahan: {severity}
        
        Detail lengkap: {url}
        
        Tim Lapor Jalan
      `
    },
    sms: 'LaporJalan: Tugas baru {trackingCode} - {title} di {address}. Detail: {url}',
    push: {
      title: 'Tugas Baru',
      body: '{trackingCode} - {title}'
    }
  },
  
  // Authority notification
  AUTHORITY_NEW_REPORT: {
    whatsapp: '🚨 LAPORAN BARU MASUK\n\n{title}\nLokasi: {address}\nJenis: {damageType}\nKeparahan: {severity}\nKode: {trackingCode}\n\nDetail & Koordinat: {url}\n\nMohon segera ditindaklanjuti.',
    email: {
      subject: '[URGENT] Laporan Baru Kerusakan Jalan - {trackingCode}',
      body: `
        Yth. {authorityName},
        
        Telah masuk laporan kerusakan jalan baru yang berada di wilayah kerja Anda:
        
        Detail Laporan:
        - Kode Tracking: {trackingCode}
        - Judul: {title}
        - Lokasi: {address}
        - Koordinat: {latitude}, {longitude}
        - Jenis Kerusakan: {damageType}
        - Tingkat Keparahan: {severity}
        - Waktu Lapor: {submittedAt}
        
        Foto & Analisis AI: {url}
        
        Mohon segera diverifikasi dan ditindaklanjuti sesuai SLA.
        
        Sistem Lapor Jalan
      `
    },
    sms: '[LaporJalan] Laporan baru {trackingCode}: {title} di {address}. {damageType} {severity}. Detail: {url}',
    push: {
      title: '🚨 Laporan Baru',
      body: '{trackingCode} - {damageType} {severity} di {address}'
    }
  },
  
  // Resolution notification
  REPORT_RESOLVED: {
    whatsapp: '✅ Laporan *{trackingCode}* ({title}) telah *SELESAI*. {message}\n\nTerima kasih telah menggunakan Lapor Jalan!',
    email: {
      subject: 'Laporan Selesai - {trackingCode}',
      body: `
        Halo {name},
        
        Kabar baik! Laporan Anda telah diselesaikan:
        
        - Kode Tracking: {trackingCode}
        - Judul: {title}
        - Status: RESOLVED
        - Catatan Penyelesaian: {message}
        
        Detail lengkap: {url}
        
        Terima kasih telah peduli dengan infrastruktur jalan kita bersama.
        
        Tim Lapor Jalan
      `
    },
    sms: 'LaporJalan: Laporan {trackingCode} SELESAI. {message}. Terima kasih!',
    push: {
      title: '✅ Laporan Selesai',
      body: '{trackingCode} - {title}'
    }
  }
};

// ─────────────────────────────────────────────
// Core Notification Functions
// ─────────────────────────────────────────────

/**
 * Send notification via multiple channels
 */
export async function sendNotification(payload: NotificationPayload): Promise<{ success: boolean; channels: string[]; errors: string[] }> {
  const channels: string[] = [];
  const errors: string[] = [];
  
  // Get user for personalization
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return { success: false, channels: [], errors: ['User not found'] };
  }
  
  // Prepare template data
  const templateData = {
    name: user.name,
    ...payload.data
  };
  
  // Send via each channel based on type or all enabled
  const channelsToSend = getChannelsForType(payload.type);
  
  for (const channel of channelsToSend) {
    try {
      const sent = await sendViaChannel(channel, payload, templateData);
      if (sent) channels.push(channel);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${channel}: ${errMsg}`);
      console.error(`[Notification] ${channel} failed:`, errMsg);
    }
  }
  
  // Save notification record
  await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data as any
    }
  });
  
  return {
    success: channels.length > 0,
    channels,
    errors
  };
}

/**
 * Determine which channels to use for a notification type
 */
function getChannelsForType(type: NotificationType): NotificationType[] {
  // If specific type requested, use that
  if (type !== 'IN_APP') return [type];
  
  // Otherwise use all enabled channels
  const enabled: NotificationType[] = ['IN_APP'];
  if (NOTIFICATION_CONFIG.whatsapp.enabled) enabled.push('WHATSAPP');
  if (NOTIFICATION_CONFIG.email.enabled) enabled.push('EMAIL');
  if (NOTIFICATION_CONFIG.sms.enabled) enabled.push('SMS');
  if (NOTIFICATION_CONFIG.push.enabled) enabled.push('PUSH');
  
  return enabled;
}

/**
 * Send via specific channel
 */
async function sendViaChannel(
  channel: NotificationType,
  payload: NotificationPayload,
  templateData: Record<string, any>
): Promise<boolean> {
  switch (channel) {
    case 'WHATSAPP':
      return await sendWhatsApp(payload, templateData);
    case 'EMAIL':
      return await sendEmail(payload, templateData);
    case 'SMS':
      return await sendSMS(payload, templateData);
    case 'PUSH':
      return await sendPush(payload, templateData);
    case 'IN_APP':
      // Already saved to DB above
      return true;
    default:
      return false;
  }
}

// ─────────────────────────────────────────────
// Channel Implementations
// ─────────────────────────────────────────────

/**
 * Send WhatsApp message via HTTP API
 * Supports Twilio, Gupshup, Wati, or generic WhatsApp Business API
 */
async function sendWhatsApp(payload: NotificationPayload, data: Record<string, any>): Promise<boolean> {
  const config = NOTIFICATION_CONFIG.whatsapp;
  
  if (!config.enabled) {
    // Fallback: generate deep link for manual sending
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.phone) {
      const message = renderTemplate(getTemplate(payload.type, 'whatsapp'), data);
      const link = `https://wa.me/${user.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      console.log('[Notification] WhatsApp deep link (manual):', link);
    }
    return false;
  }
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user?.phone) {
    console.error('[Notification] User has no phone number for WhatsApp');
    return false;
  }
  
  const message = renderTemplate(getTemplate(payload.type, 'whatsapp'), data);
  const phone = user.phone.replace(/\D/g, '');
  
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        type: 'text',
        text: { body: message }
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Notification] WhatsApp API error:', response.status, errorText);
      return false;
    }
    
    console.log('[Notification] WhatsApp sent to', phone);
    return true;
  } catch (error) {
    console.error('[Notification] WhatsApp send failed:', error);
    return false;
  }
}

/**
 * Send Email via SMTP
 */
async function sendEmail(payload: NotificationPayload, data: Record<string, any>): Promise<boolean> {
  const config = NOTIFICATION_CONFIG.email;
  if (!config.enabled) return false;
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user?.email) {
    console.error('[Notification] User has no email');
    return false;
  }
  
  const template = getTemplate(payload.type, 'email') as { subject: string; body: string } | null;
  if (!template) return false;
  
  const subject = replacePlaceholders(template.subject, data);
  const body = replacePlaceholders(template.body, data);
  
  try {
    // Simple SMTP send via fetch (for services like Mailgun, SendGrid)
    const response = await fetch(`https://api.mailgun.net/v3/${config.host}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${config.user}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: user.email,
        subject,
        html: body.replace(/\n/g, '<br>'),
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Notification] Email API error:', response.status, errorText);
      return false;
    }
    
    console.log('[Notification] Email sent to', user.email);
    return true;
  } catch (error) {
    console.error('[Notification] Email send failed:', error);
    return false;
  }
}

/**
 * Send SMS via SMS gateway API
 */
async function sendSMS(payload: NotificationPayload, data: Record<string, any>): Promise<boolean> {
  const config = NOTIFICATION_CONFIG.sms;
  if (!config.enabled) return false;
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user?.phone) {
    console.error('[Notification] User has no phone for SMS');
    return false;
  }
  
  const message = renderTemplate(getTemplate(payload.type, 'sms'), data);
  const phone = user.phone.replace(/\D/g, '');
  
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        message,
        senderId: config.senderId,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Notification] SMS API error:', response.status, errorText);
      return false;
    }
    
    console.log('[Notification] SMS sent to', phone);
    return true;
  } catch (error) {
    console.error('[Notification] SMS send failed:', error);
    return false;
  }
}

/**
 * Send Push Notification (FCM/Web Push)
 */
async function sendPush(payload: NotificationPayload, data: Record<string, any>): Promise<boolean> {
  const config = NOTIFICATION_CONFIG.push;
  if (!config.enabled) return false;
  
  const template = getTemplate(payload.type, 'push') as { title: string; body: string } | null;
  if (!template) return false;
  
  const title = replacePlaceholders(template.title, data);
  const body = replacePlaceholders(template.body, data);
  
  try {
    // FCM HTTP v1 API
    const response = await fetch('https://fcm.googleapis.com/v1/projects/lapor-jalan/messages:send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: data.fcmToken,
          notification: { title, body },
          data: { reportId: data.reportId, type: payload.type },
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Notification] Push API error:', response.status, errorText);
      return false;
    }
    
    console.log('[Notification] Push sent');
    return true;
  } catch (error) {
    console.error('[Notification] Push send failed:', error);
    return false;
  }
}

// ─────────────────────────────────────────────
// Template Rendering
// ─────────────────────────────────────────────

function getTemplate(type: string, channel: string): any {
  const templateKey = type as keyof typeof TEMPLATES;
  const template = TEMPLATES[templateKey];
  if (!template) return null;
  
  const channelTemplate = template[channel as keyof typeof template];
  return channelTemplate || null;
}

function renderTemplate(template: string | { subject: string; body: string } | { title: string; body: string } | null, data: Record<string, any>): string {
  if (!template) return '';
  
  if (typeof template === 'string') {
    return replacePlaceholders(template, data);
  }
  
  if ('subject' in template) {
    return replacePlaceholders(template.body, data);
  }
  
  if ('title' in template) {
    return replacePlaceholders(template.body, data);
  }
  
  return '';
}

function replacePlaceholders(template: string, data: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}

// ─────────────────────────────────────────────
// High-Level Notification Functions
// ─────────────────────────────────────────────

/**
 * Notify reporter of new report
 */
export async function notifyReportSubmitted(
  userId: string,
  reportId: string,
  trackingCode: string,
  title: string,
  address: string,
  damageType: string,
  severity: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${frontendUrl}/track/${trackingCode}`;
  
  return sendNotification({
    userId,
    reportId,
    type: 'WHATSAPP',
    title: 'Laporan Diterima',
    message: `Laporan "${title}" diterima dengan kode ${trackingCode}`,
    data: {
      name: '', // Will be filled from user
      title,
      trackingCode,
      address,
      damageType,
      severity,
      url
    }
  });
}

/**
 * Notify reporter of status change
 */
export async function notifyStatusChange(
  userId: string,
  reportId: string,
  trackingCode: string,
  title: string,
  oldStatus: string,
  newStatus: string,
  message: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${frontendUrl}/track/${trackingCode}`;
  
  return sendNotification({
    userId,
    reportId,
    type: 'WHATSAPP',
    title: 'Update Status Laporan',
    message: `Status ${trackingCode} berubah: ${oldStatus} → ${newStatus}`,
    data: {
      name: '',
      title,
      trackingCode,
      oldStatus,
      newStatus,
      message,
      url
    }
  });
}

/**
 * Notify authority of new report
 */
export async function notifyAuthorityNewReport(
  authorityId: string,
  reportId: string,
  trackingCode: string,
  title: string,
  address: string,
  latitude: number,
  longitude: number,
  damageType: string,
  severity: string,
  authorityName: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${frontendUrl}/authority/reports/${reportId}`;
  
  // Get authority user (staff assigned to this authority)
  const staff = await prisma.user.findFirst({
    where: { authorityId, role: 'AUTHORITY_STAFF' }
  });
  
  if (!staff) {
    console.warn('[Notification] No staff found for authority:', authorityId);
    return { success: false, channels: [], errors: ['No staff assigned'] };
  }
  
  return sendNotification({
    userId: staff.id,
    reportId,
    type: 'WHATSAPP',
    title: 'Laporan Baru Masuk',
    message: `Laporan baru ${trackingCode} di wilayah Anda`,
    data: {
      authorityName,
      title,
      address,
      latitude,
      longitude,
      damageType,
      severity,
      trackingCode,
      submittedAt: new Date().toISOString(),
      url
    }
  });
}

/**
 * Notify staff of assignment
 */
export async function notifyStaffAssigned(
  staffId: string,
  reportId: string,
  trackingCode: string,
  title: string,
  address: string,
  damageType: string,
  severity: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${frontendUrl}/staff/reports/${reportId}`;
  const staff = await prisma.user.findUnique({ where: { id: staffId } });
  
  return sendNotification({
    userId: staffId,
    reportId,
    type: 'WHATSAPP',
    title: 'Tugas Baru',
    message: `Anda ditugaskan laporan ${trackingCode}`,
    data: {
      staffName: staff?.name || 'Petugas',
      title,
      address,
      damageType,
      severity,
      trackingCode,
      url
    }
  });
}

/**
 * Notify reporter of resolution
 */
export async function notifyReportResolved(
  userId: string,
  reportId: string,
  trackingCode: string,
  title: string,
  message: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${frontendUrl}/track/${trackingCode}`;
  
  return sendNotification({
    userId,
    reportId,
    type: 'WHATSAPP',
    title: 'Laporan Selesai',
    message: `Laporan ${trackingCode} telah diselesaikan`,
    data: {
      name: '',
      title,
      trackingCode,
      message,
      url
    }
  });
}

/**
 * Send bulk notification (e.g., broadcast to all authorities in area)
 */
export async function sendBulkNotification(
  userIds: string[],
  payload: Omit<NotificationPayload, 'userId'>
): Promise<{ success: number; failed: number; results: any[] }> {
  const results = [];
  let success = 0, failed = 0;
  
  for (const userId of userIds) {
    try {
      const result = await sendNotification({ ...payload, userId });
      results.push({ userId, ...result });
      if (result.success) success++;
      else failed++;
    } catch (error) {
      results.push({ userId, success: false, error: String(error) });
      failed++;
    }
  }
  
  return { success, failed, results };
}

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      email: true, 
      phone: true, 
      notifications: { 
        where: { isRead: false },
        take: 10,
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  
  return {
    email: user?.email,
    phone: user?.phone,
    whatsapp: user?.phone ? `https://wa.me/${user.phone.replace(/\D/g, '')}` : null,
    unreadCount: user?.notifications.length || 0,
    recentNotifications: user?.notifications || []
  };
}

/**
 * Mark notifications as read
 */
export async function markNotificationsRead(userId: string, notificationIds?: string[]) {
  if (notificationIds && notificationIds.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId },
      data: { isRead: true }
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }
}