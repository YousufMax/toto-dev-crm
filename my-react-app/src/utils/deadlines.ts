/**
 * Deadlines and Countdown Engine for TOTO Development CRM
 * 
 * Strict Timezone: Asia/Dhaka (BST, UTC+6)
 * Pure dynamic client-side calculations — never writes back to Google Sheets.
 */

import { OrderDeliveryStatus } from '../types';

export type DeadlineState = 
  | 'Overdue' 
  | 'Critical' 
  | 'Urgent' 
  | 'Due Soon' 
  | 'On Track' 
  | 'No Deadline';

export interface DeadlineInfo {
  hasDeadline: boolean;
  formattedDeadline: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueWithin24h: boolean;
  timeRemainingStr: string;
  state: DeadlineState;
  diffMs: number;
  urgencyRank: number;
  colorClass: {
    badge: string;
    text: string;
    border: string;
    dot: string;
  };
}

export const ACTIVE_DELIVERY_STATUSES: OrderDeliveryStatus[] = [
  'Pending',
  'In Progress',
  'On Hold',
  'Review',
  'Revision',
];

export function isActiveOrder(deliveryStatus: string): boolean {
  return ACTIVE_DELIVERY_STATUSES.includes(deliveryStatus as OrderDeliveryStatus);
}

export function getDhakaNow(): Date {
  const now = new Date();
  const dhakaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
  return new Date(dhakaStr);
}

export function parseDeadlineDhaka(raw: string | undefined | null): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'Open (No Deadline)' || trimmed === 'N/A' || trimmed === '—') {
    return null;
  }

  try {
    const matchYMDTime = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (matchYMDTime) {
      const year = parseInt(matchYMDTime[1], 10);
      const month = parseInt(matchYMDTime[2], 10) - 1;
      const day = parseInt(matchYMDTime[3], 10);
      const hour = parseInt(matchYMDTime[4], 10);
      const minute = parseInt(matchYMDTime[5], 10);
      const second = matchYMDTime[6] ? parseInt(matchYMDTime[6], 10) : 0;
      return new Date(year, month, day, hour, minute, second);
    }

    const matchYMD = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchYMD) {
      const year = parseInt(matchYMD[1], 10);
      const month = parseInt(matchYMD[2], 10) - 1;
      const day = parseInt(matchYMD[3], 10);
      return new Date(year, month, day, 23, 59, 59);
    }

    const matchDMY = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (matchDMY) {
      const day = parseInt(matchDMY[1], 10);
      const month = parseInt(matchDMY[2], 10) - 1;
      const year = parseInt(matchDMY[3], 10);
      const hour = matchDMY[4] ? parseInt(matchDMY[4], 10) : 23;
      const minute = matchDMY[5] ? parseInt(matchDMY[5], 10) : 59;
      return new Date(year, month, day, hour, minute, 59);
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

export function formatDurationHuman(diffMs: number): string {
  const isOverdue = diffMs < 0;
  const absMs = Math.abs(diffMs);

  const totalMinutes = Math.floor(absMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  let timeStr = '';
  if (days > 0) {
    timeStr = `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
  } else if (hours > 0) {
    timeStr = `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  } else {
    timeStr = `${Math.max(1, minutes)}m`;
  }

  if (isOverdue) {
    return `OVERDUE — ${timeStr}`;
  }
  return timeStr;
}

export function calculateDeadlineInfo(
  deadlineStr: string | undefined | null,
  deliveryStatus: string,
  nowDhaka?: Date
): DeadlineInfo {
  const deadlineDate = parseDeadlineDhaka(deadlineStr);
  const now = nowDhaka || getDhakaNow();

  if (!deadlineDate) {
    return {
      hasDeadline: false,
      formattedDeadline: deadlineStr || 'Open (No Deadline)',
      isOverdue: false,
      isDueToday: false,
      isDueWithin24h: false,
      timeRemainingStr: 'No Deadline',
      state: 'No Deadline',
      diffMs: Infinity,
      urgencyRank: 6,
      colorClass: {
        badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        text: 'text-slate-400',
        border: 'border-slate-700/50',
        dot: 'bg-slate-400',
      },
    };
  }

  const formattedDeadline = deadlineDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  const isDueToday = 
    deadlineDate.getFullYear() === now.getFullYear() &&
    deadlineDate.getMonth() === now.getMonth() &&
    deadlineDate.getDate() === now.getDate();

  const isDueWithin24h = diffMs >= 0 && diffHours <= 24;
  const isOverdue = diffMs < 0;

  let state: DeadlineState = 'On Track';
  let urgencyRank = 5;
  let colorClass = {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  };

  if (isOverdue) {
    state = 'Overdue';
    urgencyRank = 1;
    colorClass = {
      badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-bold',
      text: 'text-rose-400',
      border: 'border-rose-500/40',
      dot: 'bg-rose-500 animate-pulse',
    };
  } else if (diffHours < 6) {
    state = 'Critical';
    urgencyRank = 2;
    colorClass = {
      badge: 'bg-red-500/15 text-red-400 border-red-500/30 font-semibold',
      text: 'text-red-400',
      border: 'border-red-500/40',
      dot: 'bg-red-500',
    };
  } else if (diffHours <= 24) {
    state = 'Urgent';
    urgencyRank = 3;
    colorClass = {
      badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-medium',
      text: 'text-amber-400',
      border: 'border-amber-500/40',
      dot: 'bg-amber-400',
    };
  } else if (diffHours <= 72) {
    state = 'Due Soon';
    urgencyRank = 4;
    colorClass = {
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      dot: 'bg-blue-400',
    };
  } else {
    state = 'On Track';
    urgencyRank = 5;
    colorClass = {
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
    };
  }

  if (!isActiveOrder(deliveryStatus)) {
    urgencyRank = 6;
  }

  const timeRemainingStr = formatDurationHuman(diffMs);

  return {
    hasDeadline: true,
    formattedDeadline,
    isOverdue,
    isDueToday,
    isDueWithin24h,
    timeRemainingStr,
    state,
    diffMs,
    urgencyRank,
    colorClass,
  };
}
