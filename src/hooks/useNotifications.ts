import { useEffect } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import type { Assignment, StudyBlock, Course, TermConfig } from '../types';
import { detectCrunchWeeks } from '../scheduler';

const CRUNCH_KEY = 'sb_crunch_notif_date';
const BLOCKS_KEY = 'sb_blocks_notif_date';

export function useNotifications({
  courses,
  assignments,
  studyBlocks,
  today,
  termConfig,
  enabled,
}: {
  courses: Course[];
  assignments: Assignment[];
  studyBlocks: StudyBlock[];
  today: Date;
  termConfig: TermConfig;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const todayStr = format(today, 'yyyy-MM-dd');

    // ── Crunch week ahead ──────────────────────────────────────────────────────
    if (localStorage.getItem(CRUNCH_KEY) !== todayStr) {
      const crunchWeeks = detectCrunchWeeks(assignments, today, termConfig);
      const soon = crunchWeeks.filter(cw => {
        const days = differenceInDays(parseISO(cw.weekStart), today);
        return days >= 1 && days <= 7;
      });

      if (soon.length > 0) {
        const cw = soon[0];
        const codes = [
          ...new Set(
            cw.assignments
              .map(a => courses.find(c => c.id === a.courseId)?.code)
              .filter(Boolean)
          ),
        ].join(', ');

        new Notification('⚡ Crunch Week Ahead — SyllaBros', {
          body: `Week of ${format(parseISO(cw.weekStart), 'MMM d')} · ${cw.totalWeight}% of grades at stake${codes ? ` · ${codes}` : ''}. Start preparing now.`,
          icon: '/sb-logo.png',
          tag: 'crunch-week',
          requireInteraction: false,
        });

        localStorage.setItem(CRUNCH_KEY, todayStr);
      }
    }

    // ── Today's study blocks ───────────────────────────────────────────────────
    if (localStorage.getItem(BLOCKS_KEY) !== todayStr) {
      const todayBlocks = studyBlocks.filter(
        b => b.date === todayStr && !b.isCompleted
      );

      if (todayBlocks.length > 0) {
        const totalMins = todayBlocks.reduce((s, b) => s + b.duration, 0);
        const hours = Math.round((totalMins / 60) * 10) / 10;
        const codes = [
          ...new Set(
            todayBlocks
              .map(b => courses.find(c => c.id === b.courseId)?.code)
              .filter(Boolean)
          ),
        ].join(', ');

        new Notification(
          `📚 ${todayBlocks.length} Study Block${todayBlocks.length > 1 ? 's' : ''} Scheduled Today — SyllaBros`,
          {
            body: `${hours}h of study time · ${codes}`,
            icon: '/sb-logo.png',
            tag: 'study-blocks',
            requireInteraction: false,
          }
        );

        localStorage.setItem(BLOCKS_KEY, todayStr);
      }
    }
  }, [enabled, courses, assignments, studyBlocks, today, termConfig]);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.requestPermission();
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
