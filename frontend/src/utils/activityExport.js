import { shareFilesOrDownloadFirst } from './shareExport';

/** @param {string} isoDate YYYY-MM-DD */
function parseLocalDayStart(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** @param {string} isoDate YYYY-MM-DD */
function parseLocalDayEnd(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/**
 * @param {object[]} activities Garmin activity list
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 */
export function filterActivitiesByDateRange(activities, startDate, endDate) {
  const start = parseLocalDayStart(startDate);
  const end = parseLocalDayEnd(endDate);
  return activities.filter((a) => {
    const date = new Date(a.startTimeLocal);
    return date >= start && date <= end;
  });
}

function toIsoDate(activity) {
  const d = new Date(activity.startTimeLocal);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatActivityType(activity) {
  return activity.activityType?.typeKey || 'unknown';
}

/** Time actually moving (run/swim/cycle), excluding rest and long pauses. */
function getMovingDurationSeconds(activity) {
  const moving = activity.movingDuration;
  if (moving != null && moving > 0) return moving;
  return activity.duration || 0;
}

/**
 * Markdown table + short header — compact and easy for LLMs to parse.
 * @param {object[]} activities
 * @param {{ startDate: string, endDate: string }} range
 */
export function buildLlmActivitiesMarkdown(activities, { startDate, endDate }) {
  const sorted = [...activities].sort(
    (a, b) => new Date(a.startTimeLocal) - new Date(b.startTimeLocal),
  );

  const lines = [
    '# Garmin training activities',
    '',
    `**Period:** ${startDate} → ${endDate}`,
    `**Sessions:** ${sorted.length}`,
    '',
    'Column units: `date` (ISO local), `activity_type` (Garmin key), `moving_duration_min` (time in motion, minutes — excludes rest/pauses), `distance_km` (km), `avg_hr_bpm` (average heart rate, empty if missing).',
    '',
    '| date | activity_type | moving_duration_min | distance_km | avg_hr_bpm |',
    '|------|---------------|---------------------|---------------|------------|',
  ];

  for (const a of sorted) {
    const durationMin = (getMovingDurationSeconds(a) / 60).toFixed(1);
    const distanceKm = ((a.distance || 0) / 1000).toFixed(2);
    const avgHr = a.averageHR != null && a.averageHR > 0 ? String(Math.round(a.averageHR)) : '';
    lines.push(
      `| ${toIsoDate(a)} | ${formatActivityType(a)} | ${durationMin} | ${distanceKm} | ${avgHr} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function buildActivitiesExportFile(filtered, { startDate, endDate }) {
  const markdown = buildLlmActivitiesMarkdown(filtered, { startDate, endDate });
  const filename = `activities_${startDate}_${endDate}.md`;
  const file = new File([markdown], filename, { type: 'text/markdown;charset=utf-8' });
  return { file, markdown, filename };
}

/**
 * @param {object[]} activities
 * @param {{ startDate: string, endDate: string }} range
 * @returns {Promise<{ count: number, method: 'shared' | 'downloaded' }>}
 */
export async function shareActivitiesForLlm(activities, { startDate, endDate }) {
  const filtered = filterActivitiesByDateRange(activities, startDate, endDate);
  const { file, filename } = buildActivitiesExportFile(filtered, { startDate, endDate });
  const method = await shareFilesOrDownloadFirst([file], { title: filename });
  return { count: filtered.length, method };
}

/**
 * Best on phone: paste directly into a chat LLM.
 * @param {object[]} activities
 * @param {{ startDate: string, endDate: string }} range
 */
export async function copyActivitiesForLlm(activities, { startDate, endDate }) {
  const filtered = filterActivitiesByDateRange(activities, startDate, endDate);
  const { markdown } = buildActivitiesExportFile(filtered, { startDate, endDate });
  if (!navigator.clipboard?.writeText) {
    throw new Error('Copie non supportée sur ce navigateur.');
  }
  await navigator.clipboard.writeText(markdown);
  return filtered.length;
}

export function countActivitiesInRange(activities, startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) return 0;
  return filterActivitiesByDateRange(activities, startDate, endDate).length;
}

function formatIsoLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Default start date: 90 days before today (local). */
export function defaultExportStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return formatIsoLocalDate(d);
}

export function defaultExportEndDate() {
  return formatIsoLocalDate(new Date());
}
